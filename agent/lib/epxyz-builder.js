import crypto from 'node:crypto';

const DEFAULT_CONFIG = {
  mathCellConfig: {
    symbolicOutput: false,
    showIntermediateResults: false,
    formatOptions: {
      notation: 'auto',
      precision: 15,
      lowerExp: -3,
      upperExp: 5
    }
  },
  customBaseUnits: {
    mass: 'kg',
    length: 'm',
    time: 's',
    current: 'A',
    temperature: 'K',
    luminous_intensity: 'cd',
    amount_of_substance: 'mol',
    force: 'N',
    area: 'm^2',
    volume: 'm^3',
    energy: 'J',
    power: 'W',
    pressure: 'Pa',
    charge: 'C',
    capacitance: 'F',
    electric_potential: 'V',
    resistance: 'ohm',
    inductance: 'H',
    conductance: 'S',
    magnetic_flux: 'Wb',
    magnetic_flux_density: 'T',
    angle: 'rad',
    information: 'b'
  },
  simplifySymbolicExpressions: true,
  convertFloatsToFractions: true,
  fluidConfig: {
    fluid: 'Water',
    incompMixConc: 0.5,
    customMixture: [
      { fluid: 'R32', moleFraction: 0.697615 },
      { fluid: 'R125', moleFraction: 0.302385 }
    ]
  }
};

export function buildEpxyzDocument({
  title,
  cells,
  sheetId = crypto.randomUUID(),
  creationIso = new Date().toISOString(),
  version = 20260313
}) {
  if (!Array.isArray(cells) || cells.length === 0) {
    throw new Error('Cannot build .epxyz without at least one cell');
  }

  const nextId = cells.reduce((max, cell) => Math.max(max, cell.id), -1) + 1;

  return {
    data: {
      version,
      config: structuredClone(DEFAULT_CONFIG),
      cells,
      title,
      results: [],
      system_results: [],
      codeCellResults: {},
      sub_results: [],
      nextId,
      sheetId,
      insertedSheets: []
    },
    history: [
      {
        url: title,
        hash: 'file',
        creation: creationIso
      }
    ]
  };
}

export { DEFAULT_CONFIG };
