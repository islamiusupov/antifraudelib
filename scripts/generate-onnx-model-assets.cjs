const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODEL_DIR = path.join(ROOT, 'packages', 'ml', 'models');
const FLOAT_TENSOR_TYPE = 1;
const DEFAULT_OPSET_VERSION = 13;
const DEFAULT_IR_VERSION = 8;

const models = [
  {
    filename: 'keystroke-dynamics.onnx',
    graphName: 'keystroke_dynamics_timing_graph',
    inputName: 'features',
    outputName: 'probability',
    weights: [2.4, 0.7, 2],
    bias: -3,
    metadata: {
      model_id: 'keystroke-dynamics-timing-v0',
      feature_order: 'meanRelativeDeviation,maxRelativeDeviation,longPauseRatio',
    },
  },
  {
    filename: 'urlbert-tiny-v4.onnx',
    graphName: 'phishing_url_risk_graph',
    inputName: 'features',
    outputName: 'probability',
    weights: [-6, 1.3, 2.5, 1.2, 1.4, 0.9, 0.6, 0.7, 1],
    bias: -2.5,
    metadata: {
      model_id: 'urlbert-tiny-v4-fallback-v0',
      feature_order:
        'allowedDomainMatch,hasIpAddress,hasSuspiciousToken,hasRiskyTld,hasPunycode,hasAtSign,hasManySubdomains,isLongUrl,hasBrandMimicry',
    },
  },
];

fs.mkdirSync(MODEL_DIR, { recursive: true });

for (const model of models) {
  const bytes = buildModel(model);
  fs.writeFileSync(path.join(MODEL_DIR, model.filename), bytes);
  console.log(`${model.filename}: ${bytes.length} bytes`);
}

function buildModel(model) {
  const inputSize = model.weights.length;
  const graph = graphProto({
    name: model.graphName,
    inputName: model.inputName,
    outputName: model.outputName,
    inputSize,
    weights: model.weights,
    bias: model.bias,
  });
  const opset = operatorSetIdProto(DEFAULT_OPSET_VERSION);
  const metadataEntries = Object.entries(model.metadata).map(([key, value]) => metadataEntryProto(key, value));

  return concat([
    int64Field(1, DEFAULT_IR_VERSION),
    stringField(2, 'deepcode-antifraud'),
    stringField(3, '0.0.1'),
    stringField(4, 'deepcode.ai.antifraud'),
    int64Field(5, 1),
    stringField(6, 'Deterministic antifraud feature model. Replace with trained ONNX weights for production.'),
    messageField(7, graph),
    messageField(8, opset),
    ...metadataEntries.map((entry) => messageField(14, entry)),
  ]);
}

function graphProto({ name, inputName, outputName, inputSize, weights, bias }) {
  return concat([
    nodeProto('Gemm', 'linear_score', [inputName, 'weights', 'bias'], ['logit']),
    nodeProto('Sigmoid', 'probability_score', ['logit'], [outputName]),
    stringField(2, name),
    messageField(5, tensorProto('weights', [inputSize, 1], weights)),
    messageField(5, tensorProto('bias', [1], [bias])),
    messageField(11, valueInfoProto(inputName, [1, inputSize])),
    messageField(12, valueInfoProto(outputName, [1, 1])),
  ]);
}

function nodeProto(opType, name, inputs, outputs) {
  return concat([
    ...inputs.map((input) => stringField(1, input)),
    ...outputs.map((output) => stringField(2, output)),
    stringField(3, name),
    stringField(4, opType),
  ]);
}

function tensorProto(name, dimensions, values) {
  const rawData = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => rawData.writeFloatLE(value, index * 4));

  return concat([
    ...dimensions.map((dimension) => int64Field(1, dimension)),
    int32Field(2, FLOAT_TENSOR_TYPE),
    stringField(8, name),
    bytesField(9, rawData),
  ]);
}

function valueInfoProto(name, dimensions) {
  return concat([stringField(1, name), messageField(2, typeProto(dimensions))]);
}

function typeProto(dimensions) {
  return messageField(
    1,
    concat([int32Field(1, FLOAT_TENSOR_TYPE), messageField(2, tensorShapeProto(dimensions))]),
  );
}

function tensorShapeProto(dimensions) {
  return concat(dimensions.map((dimension) => messageField(1, int64Field(1, dimension))));
}

function operatorSetIdProto(version) {
  return int64Field(2, version);
}

function metadataEntryProto(key, value) {
  return concat([stringField(1, key), stringField(2, value)]);
}

function int32Field(fieldNumber, value) {
  return field(fieldNumber, 0, varint(value));
}

function int64Field(fieldNumber, value) {
  return field(fieldNumber, 0, varint(value));
}

function stringField(fieldNumber, value) {
  return bytesField(fieldNumber, Buffer.from(value, 'utf8'));
}

function messageField(fieldNumber, value) {
  return bytesField(fieldNumber, value);
}

function bytesField(fieldNumber, value) {
  return field(fieldNumber, 2, concat([varint(value.length), value]));
}

function field(fieldNumber, wireType, value) {
  return concat([varint((fieldNumber << 3) | wireType), value]);
}

function varint(value) {
  let remaining = BigInt(value);
  const bytes = [];

  do {
    let byte = Number(remaining & 0x7fn);
    remaining >>= 7n;
    if (remaining !== 0n) byte |= 0x80;
    bytes.push(byte);
  } while (remaining !== 0n);

  return Buffer.from(bytes);
}

function concat(parts) {
  return Buffer.concat(parts);
}
