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
  'Radiation Hazard'  = '#ffd500',
  'Biological Hazard' = '#0000ff',
  'Toxic Hazard'      = '#136000',
  'Fire'              = '#ff6a00',
  'Ruins'             = '#0e0e0e',
  'Active Warzone'    = '#ff0000',
  'Low Air Quality'   = '#757575'
}

export enum PatternType {
  Solid   = 'solid',
  Sawtooth = 'sawtooth',
  Wavy    = 'wavy'
}

export enum exclusionZonePattern {
  'Flood Zone'        = PatternType.Wavy,
  'Radiation Hazard'  = PatternType.Solid,
  'Biological Hazard' = PatternType.Solid,
  'Toxic Hazard'      = PatternType.Solid,
  'Fire'              = PatternType.Solid,
  'Ruins'             = PatternType.Solid,
  'Active Warzone'    = PatternType.Sawtooth,
  'Low Air Quality'   = PatternType.Solid
}
//endregion