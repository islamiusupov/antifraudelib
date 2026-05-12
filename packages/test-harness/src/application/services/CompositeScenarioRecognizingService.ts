import type { CatalogScenarioEntity, CompositeScenarioEntity, ParsedScenarioCatalogEntity } from '@deepcode/antifraud-scenario-catalog';
import type { CompositeScenarioRecognitionEntity } from '../../domain/entities/CompositeScenarioRecognitionEntity';
import type { ScenarioRecognitionEntity } from '../../domain/entities/ScenarioRecognitionEntity';

export class CompositeScenarioRecognizingService {
  recognize(
    recognitions: ScenarioRecognitionEntity[],
    catalog: ParsedScenarioCatalogEntity,
  ): CompositeScenarioRecognitionEntity[] {
    const catalogScenarioById = new Map(catalog.scenarios.map((scenario) => [scenario.id, scenario]));
    const recognitionByScenarioId = this.indexRecognitionsByScenarioId(recognitions);

    return catalog.composites
      .map((composite) => this.tryRecognize(composite, catalogScenarioById, recognitionByScenarioId))
      .filter((recognition): recognition is CompositeScenarioRecognitionEntity => recognition !== null);
  }

  private tryRecognize(
    composite: CompositeScenarioEntity,
    catalogScenarioById: Map<string, CatalogScenarioEntity>,
    recognitionByScenarioId: Map<string, ScenarioRecognitionEntity>,
  ): CompositeScenarioRecognitionEntity | null {
    const requiredScenarios = this.findRequiredScenarios(composite, catalogScenarioById);
    if (requiredScenarios.length !== composite.combo.length) return null;

    const matchedRecognitions = composite.combo.map((scenarioId) => recognitionByScenarioId.get(scenarioId));
    if (matchedRecognitions.some((recognition) => recognition === undefined)) return null;

    const confidentRecognitions = matchedRecognitions.filter(
      (recognition): recognition is ScenarioRecognitionEntity => recognition !== undefined,
    );

    return {
      id: composite.id,
      title: composite.title,
      confidence: Math.min(...confidentRecognitions.map((recognition) => recognition.confidence)),
      requiredScenarioIds: composite.combo,
      matchedScenarioIds: composite.combo,
      factors: this.unique(requiredScenarios.map((scenario) => scenario.factor)),
      reasonCodes: this.unique([`composite_${composite.id.toLowerCase()}`, ...this.collectReasonCodes(confidentRecognitions)]),
      expectedVerdict: composite.normalizedVerdict,
    };
  }

  private findRequiredScenarios(
    composite: CompositeScenarioEntity,
    catalogScenarioById: Map<string, CatalogScenarioEntity>,
  ): CatalogScenarioEntity[] {
    return composite.combo
      .map((scenarioId) => catalogScenarioById.get(scenarioId))
      .filter((scenario): scenario is CatalogScenarioEntity => scenario !== undefined);
  }

  private indexRecognitionsByScenarioId(
    recognitions: ScenarioRecognitionEntity[],
  ): Map<string, ScenarioRecognitionEntity> {
    const recognitionByScenarioId = new Map<string, ScenarioRecognitionEntity>();

    recognitions.forEach((recognition) => {
      recognition.candidateScenarioIds.forEach((scenarioId) => {
        recognitionByScenarioId.set(scenarioId, recognition);
      });
    });

    return recognitionByScenarioId;
  }

  private collectReasonCodes(recognitions: ScenarioRecognitionEntity[]): string[] {
    const reasonCodes: string[] = [];
    recognitions.forEach((recognition) => {
      recognition.reasonCodes.forEach((reasonCode) => reasonCodes.push(reasonCode));
    });
    return reasonCodes;
  }

  private unique<T>(items: T[]): T[] {
    return items.filter((item, index) => items.indexOf(item) === index);
  }
}
