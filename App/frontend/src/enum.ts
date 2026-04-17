export enum ExclusionZoneType {
  'Flood Zone'        = 1,
  'Radiation Hazard'  = 2,
  'Biological Hazard' = 3,
  'Toxic Hazard'      = 4,
  'Fire'              = 5,
  'Ruins'             = 6,
  'Active Warzone'    = 7,
  'Low Air Quality'   = 8
}

//region Config
export enum exclusionZoneColor {
  'Flood Zone'        = '#0000ff',
  'Radiation Hazard'  = '#e1ca43',
  'Biological Hazard' = '#0f643a',
  'Toxic Hazard'      = '#136000',
  'Fire'              = '#ff6a00',
  'Ruins'             = '#0e0e0e',
  'Active Warzone'    = '#ff0000',
  'Low Air Quality'   = '#757575'
}

export enum PatternType {
  Solid   = 'solid',
  Sawtooth = 'sawtooth',
  Wavy    = 'wavy',
  Cross   = 'cross',
  AngledLines = 'angled-lines',
  VerticalWaves = 'vertical-waves',
  GammaWaves = 'gamma-waves',
  BiologicalHazard = 'biological-hazard',
  RuinsSquareSineWave = 'ruins-square-sine-wave'
}

export enum exclusionZonePattern {
  'Flood Zone'        = PatternType.Wavy,
  'Radiation Hazard'  = PatternType.GammaWaves,
  'Biological Hazard' = PatternType.BiologicalHazard,
  'Toxic Hazard'      = PatternType.Cross,
  'Fire'              = PatternType.Sawtooth,
  'Ruins'             = PatternType.RuinsSquareSineWave,
  'Active Warzone'    = PatternType.AngledLines,
  'Low Air Quality'   = PatternType.VerticalWaves
}

//endregion