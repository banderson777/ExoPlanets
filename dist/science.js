'use strict';

const evidence = {
  'WASP-39 b': 'https://science.nasa.gov/missions/webb/nasas-webb-reveals-an-exoplanet-atmosphere-as-never-before/',
  'GJ 9827 d': 'https://science.nasa.gov/missions/hubble/nasas-hubble-finds-water-vapor-in-small-exoplanets-atmosphere/',
  'WASP-96 b': 'https://science.nasa.gov/asset/webb/exoplanet-wasp-96-b-niriss-transmission-spectrum/',
  'HAT-P-11 b': 'https://science.nasa.gov/solar-system/ocean-worlds/',
  'HD 189733 b': 'https://science.nasa.gov/missions/hubble/hubble-finds-three-surprisingly-dry-exoplanets/',
  'HD 209458 b': 'https://science.nasa.gov/missions/hubble/hubble-finds-three-surprisingly-dry-exoplanets/',
  'WASP-12 b': 'https://science.nasa.gov/missions/hubble/hubble-finds-three-surprisingly-dry-exoplanets/',
  'WASP-107 b': 'https://science.nasa.gov/missions/webb/3-years-of-science-10-cosmic-surprises-from-nasas-webb-telescope/',
};
const radioBursts = new Map([
  ['bet Pic', {
    status:'Observed bursts',
    measured:'MeerKAT recorded recurring bursts across 0.856–3.5 GHz in 2025–2026, with about 40–70% circular polarization.',
    interpretation:'A 2026 preprint attributes the bursts to auroral emission from β Pictoris b based on the radio position and polarization.',
    sources:[['Preprint and light curves', 'https://arxiv.org/html/2609.16720v1'], ['SARAO archive', 'https://archive.sarao.ac.za/']],
  }],
  ['YZ Cet', {
    status:'Observed bursts',
    measured:'The Very Large Array detected coherent bursts at 2–4 GHz from the YZ Ceti system.',
    interpretation:'Two burst timings are consistent with a magnetic interaction involving YZ Ceti b. Intrinsic stellar activity is also possible.',
    sources:[['Published measurements', 'https://doi.org/10.1038/s41550-023-01914-0']],
  }],
  ['tau Boo', {
    status:'Tentative report · Follow-up nondetection',
    tentative:true,
    measured:'LOFAR reported a tentative polarized burst at 14–21 MHz. Follow-up observations at 15–40 MHz did not recover it.',
    interpretation:'The original team proposed a planetary auroral source. The source remains uncertain.',
    sources:[['Original report', 'https://doi.org/10.1051/0004-6361/201937201'], ['Follow-up study', 'https://doi.org/10.1051/0004-6361/202452868']],
  }],
  ['Sol', {
    status:'Solar System reference',
    measured:'Juno Waves measured electric and magnetic wave spectra over time near Jupiter.',
    interpretation:'The calibrated archive includes auroral radio emission and local plasma waves.',
    sources:[['Download Juno Waves data', 'https://doi.org/10.17189/1520498']],
  }],
]);

const biosignatureReports = {
  'K2-18 b': {
    molecules:'Dimethyl sulfide (DMS) and dimethyl disulfide (DMDS)',
    report:'https://arxiv.org/abs/2504.12267',
    review:'https://doi.org/10.1051/0004-6361/202555580',
  },
};
const selectedMoons = {
  Mercury: [],
  Venus: [],
  Earth: [['Moon', 'Confirmed · no habitability candidate designation', 'https://science.nasa.gov/moon/']],
  Mars: [
    ['Phobos', 'Confirmed · no habitability candidate designation', 'https://science.nasa.gov/mars/moons/phobos/'],
    ['Deimos', 'Confirmed · no habitability candidate designation', 'https://science.nasa.gov/mars/moons/deimos/'],
  ],
  Jupiter: [['Europa', 'Confirmed · habitability target because of its likely subsurface ocean', 'https://science.nasa.gov/jupiter/moons/europa/']],
  Saturn: [
    ['Enceladus', 'Confirmed · habitability target with an ocean that feeds water-rich plumes', 'https://science.nasa.gov/saturn/moons/enceladus/'],
    ['Titan', 'Confirmed · astrobiology target with complex organic chemistry', 'https://science.nasa.gov/saturn/moons/titan/'],
  ],
  'Kepler-1625 b': [['Kepler-1625 b-i', 'Disputed candidate · habitability unknown', 'https://www.nature.com/articles/s41550-025-02547-1']],
  'Kepler-1708 b': [['Kepler-1708 b-i', 'Disputed candidate · habitability unknown', 'https://www.nature.com/articles/s41550-021-01539-1']],
};
