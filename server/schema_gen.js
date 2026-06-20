import parser from 'rclnodejs/rosidl_parser/rosidl_parser.js';
import * as path from 'path';
import * as fs from 'fs';

const rosToJsonSchemaType = {
  bool:    { type: 'boolean' },
  string:  { type: 'string' },
  wstring: { type: 'string' },

  float32: { type: 'number' },
  float64: { type: 'number' },

  int8:  { type: 'integer', minimum: -128,                 maximum: 127 },
  int16: { type: 'integer', minimum: -32768,               maximum: 32767 },
  int32: { type: 'integer', minimum: -2147483648,          maximum: 2147483647 },
  int64: { type: 'integer', minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER },

  uint8:  { type: 'integer', minimum: 0, maximum: 255 },
  uint16: { type: 'integer', minimum: 0, maximum: 65535 },
  uint32: { type: 'integer', minimum: 0, maximum: 4294967295 },
  uint64: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER },

  byte: { type: 'integer', minimum: 0, maximum: 255 },
  char: { type: 'string', minLength: 1, maxLength: 1 },
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function findFiles(pkg, subdir, ext) {
  const prefixPaths = (process.env.AMENT_PREFIX_PATH || '').split(':').filter(Boolean);
  const results = [];
  for (const prefix of prefixPaths) {
    const p = path.join(prefix, 'share', pkg, subdir, `${ext}`);
    if (fs.existsSync(p)) results.push(p);
  }
  return results;
}

function findAllPackages(type) {
  const prefixPaths = (process.env.AMENT_PREFIX_PATH || '').split(':').filter(Boolean);
  const packages = new Map();
  for (const prefix of prefixPaths) {
    const shareDir = path.join(prefix, 'share');
    if (!fs.existsSync(shareDir)) continue;
    for (const pkgName of fs.readdirSync(shareDir)) {
      const typeDir = path.join(shareDir, pkgName, type);
      if (!fs.existsSync(typeDir)) continue;
      const files = fs.readdirSync(typeDir).filter((f) => f.endsWith(`.${type}`));
      if (files.length > 0) packages.set(pkgName, files);
    }
  }
  return packages;
}

function matchEnumField(schema, constants, fieldname) {
  const upper = fieldname.toUpperCase();
  const enums = [];
  for (let i = constants.length - 1; i >= 0; i--) {
    const c = constants[i];
    if (String(c.name).toUpperCase().includes(upper)) {
      enums.push(`${c.name}:${c.value}`);
      constants.splice(i, 1);
    }
  }
  if (enums.length > 0) {
    schema.properties[fieldname] = { title: fieldname, type: 'string', enum: enums };
    return true;
  }
  return false;
}

async function parseMsgFields(entity, pkg, msgFile) {
  const paths = findFiles(pkg, 'msg', msgFile);
  if (paths.length === 0) return;

  let specs = null;
  for (const p of paths) {
    try { specs = await parser.parseMessageFile(pkg, p); break; } catch (_) {}
  }
  if (!specs) return;

  if (!entity.properties) entity.properties = {};
  const constants = [...specs.constants];
  const originalOrder = specs.fields.map((f) => f.name);
  specs.fields.sort((a, b) => b.name.length - a.name.length);

  for (const field of specs.fields) {
    const baseType = field.type.type;

    if (field.type.isArray) {
      let item = {};
      if (field.type.isPrimitiveType) {
        item = clone(rosToJsonSchemaType[baseType] || { type: 'string' });
      } else {
        await parseMsgFields(item, field.type.pkgName, `${baseType}.msg`);
      }
      entity.properties[field.name] = { type: 'array', title: field.name, items: item };
      if (field.type.arraySize > 0) {
        entity.properties[field.name].minItems = field.type.arraySize;
        entity.properties[field.name].maxItems = field.type.arraySize;
      } else if (field.type.isUpperBound) {
        entity.properties[field.name].maxItems = field.type.arraySize;
      }
      continue;
    }

    if (!field.type.isPrimitiveType) {
      entity.properties[field.name] = { type: 'object', title: field.name, properties: {} };
      await parseMsgFields(entity.properties[field.name], field.type.pkgName, `${baseType}.msg`);
      continue;
    }

    if (baseType.includes('int') && matchEnumField(entity, constants, field.name)) continue;

    entity.properties[field.name] = {
      ...clone(rosToJsonSchemaType[baseType] || { type: 'string' }),
      title: field.name,
    };
  }

  const sorted = {};
  for (const key of originalOrder) {
    if (key in entity.properties) sorted[key] = entity.properties[key];
  }
  entity.properties = sorted;
}

async function parseSrvFields(entity, pkg, srvFile) {
  const paths = findFiles(pkg, 'srv', srvFile);
  if (paths.length === 0) return;

  let specs = null;
  for (const p of paths) {
    try { specs = await parser.parseServiceFile(pkg, p); break; } catch (_) {}
  }
  if (!specs) return;

  const buildFields = async (fields) => {
    const out = {};
    for (const field of fields) {
      if (field.type.isArray) {
        const item = field.type.isPrimitiveType
          ? clone(rosToJsonSchemaType[field.type.type] || { type: 'string' })
          : await readMsgSchemaFromDir(field.type.pkgName, field.type.type, null);
        out[field.name] = { type: 'array', title: field.name, items: item };
        if (field.type.arraySize > 0) {
          out[field.name].minItems = field.type.arraySize;
          out[field.name].maxItems = field.type.arraySize;
        } else if (field.type.isUpperBound) {
          out[field.name].maxItems = field.type.arraySize;
        }
      } else if (field.type.isPrimitiveType) {
        out[field.name] = { ...clone(rosToJsonSchemaType[field.type.type] || { type: 'string' }), title: field.name };
      } else {
        out[field.name] = { ...(await readMsgSchemaFromDir(field.type.pkgName, field.type.type, null)), title: field.name };
      }
    }
    return out;
  };

  entity.request  = await buildFields(specs.request.fields);
  entity.response = await buildFields(specs.response.fields);
}

async function readMsgSchemaFromDir(packageName, messageName, schemaDir) {
  if (schemaDir) {
    const p = path.join(schemaDir, `${packageName}__${messageName}.json`);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  }
  const entity = {};
  await parseMsgFields(entity, packageName, `${messageName}.msg`);
  return entity;
}

export async function generateAllSchemas(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  const msgPackages = findAllPackages('msg');
  console.log(`[schema-gen] Found ${msgPackages.size} packages with messages`);
  for (const [pkg, files] of msgPackages) {
    for (const file of files) {
      const name = file.replace('.msg', '');
      try {
        const schema = {};
        await parseMsgFields(schema, pkg, file);
        fs.writeFileSync(path.join(outputDir, `${pkg}__${name}.json`), JSON.stringify(schema, null, 2));
      } catch (e) {
        console.error(`[schema-gen] ✗ ${pkg}/${name}:`, e.message);
      }
    }
  }

  const srvPackages = findAllPackages('srv');
  console.log(`[schema-gen] Found ${srvPackages.size} packages with services`);
  for (const [pkg, files] of srvPackages) {
    for (const file of files) {
      const name = file.replace('.srv', '');
      try {
        const schema = {};
        await parseSrvFields(schema, pkg, file);
        fs.writeFileSync(path.join(outputDir, `${pkg}__${name}.json`), JSON.stringify(schema, null, 2));
      } catch (e) {
        console.error(`[schema-gen] ✗ ${pkg}/${name}:`, e.message);
      }
    }
  }
}

export async function readMsgSchema(packageName, messageName, schemaDir) {
  const p = path.join(schemaDir, `${packageName}__${messageName}.json`);
  if (!fs.existsSync(p)) throw new Error(`Schema not found: ${packageName}/${messageName}`);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export async function readSrvSchema(packageName, serviceName, schemaDir) {
  const paths = findFiles(packageName, 'srv', `${serviceName}.srv`);
  if (paths.length === 0) throw new Error(`Service file not found: ${packageName}/${serviceName}`);
  const specs = await parser.parseServiceFile(packageName, paths[0]);
  const request = {};
  for (const field of specs.request.fields) {
    if (field.type.isPrimitiveType) {
      request[field.name] = { ...clone(rosToJsonSchemaType[field.type.type] || { type: 'string' }), title: field.name };
    } else {
      request[field.name] = { ...(await readMsgSchema(field.type.pkgName, field.type.type, schemaDir)), title: field.name };
    }
  }
  return { type: 'object', properties: request };
}
