"""Convert calibrated celestial FITS images or spectral cubes into an Atlas model."""
import argparse
import json
import math
from pathlib import Path

import astropy.units as units
import numpy as np
from astropy.io import fits
from astropy.wcs import WCS


MAX_LAYERS = 64
MAX_POINTS = 60000


def layers(product, plane_limit):
    """Sample FITS sections without loading an entire cube into memory."""
    filename, extension, band = product
    extension = int(extension) if extension.isdecimal() else extension
    path = Path(filename)
    with fits.open(path, memmap=True, do_not_scale_image_data=True) as hdus:
        image = hdus[extension]
        if not image.is_image:
            raise ValueError(f"{path.name}: HDU {extension} is not an image")
        header = image.header
        shape = image.shape
        if len(shape) not in (2, 3):
            raise ValueError(f"{path.name}: expected a 2D image or 3D spectral cube")
        wcs = WCS(header, hdus)
        celestial = wcs.celestial
        if celestial.pixel_n_dim != 2 or not wcs.has_celestial:
            raise ValueError(f"{path.name}: a two-axis celestial WCS is required")
        if len(shape) == 2:
            wavelength = float(band)
            planes = [(None, wavelength)]
        else:
            if band != 'auto' or wcs.wcs.spec != 2 or wcs.axis_correlation_matrix[2].tolist() != [False, False, True]:
                raise ValueError(f"{path.name}: use auto with a separable spectral axis on FITS axis 3")
            indices = np.linspace(0, shape[0] - 1, min(shape[0], plane_limit), dtype=int)
            spectral = wcs.spectral
            values = spectral.pixel_to_world_values(indices)
            wavelengths = (values * units.Unit(spectral.world_axis_units[0])).to_value(units.um, equivalencies=units.spectral())
            planes = zip(indices, wavelengths)
        rows, columns = shape[-2:]
        stride = max(1, math.ceil(max(rows, columns) / 256))
        pixel_y, pixel_x = np.mgrid[:rows:stride, :columns:stride]
        sky = celestial.pixel_to_world(pixel_x, pixel_y).icrs
        origin = celestial.pixel_to_world((columns - 1) / 2, (rows - 1) / 2).icrs
        source = f"{path.name} [HDU {extension}]"
        observatory = str(header.get('TELESCOP', hdus[0].header.get('TELESCOP', 'Unspecified')))
        for plane, wavelength in planes:
            if not math.isfinite(wavelength) or wavelength <= 0:
                raise ValueError(f"{source}: wavelengths must be positive and finite")
            slices = (slice(None, None, stride),) * 2
            raw = np.asarray(image.section[slices if plane is None else (int(plane), *slices)])
            mask = np.isfinite(raw)
            if 'BLANK' in header and header['BITPIX'] > 0:
                mask &= raw != header['BLANK']
            data = raw.astype(float) * header.get('BSCALE', 1) + header.get('BZERO', 0)
            metadata = dict(source=source, observatory=observatory, wavelength_um=float(wavelength),
                            unit=str(header.get('BUNIT', '')), plane=None if plane is None else int(plane),
                            stride=stride)
            yield origin, sky, data, mask, metadata


def convert(products, plane_limit, percentile, target):
    """Register samples in a shared ICRS tangent frame and retain intensity values."""
    result = []
    origin = None
    for product in products:
        for center, sky, data, mask, metadata in layers(product, plane_limit):
            if origin is None:
                origin = center
            offsets = sky.transform_to(origin.skyoffset_frame())
            longitude = offsets.lon.wrap_at(180 * units.deg).to_value(units.deg)
            latitude = offsets.lat.to_value(units.deg)
            mask &= np.isfinite(data) & np.isfinite(longitude) & np.isfinite(latitude)
            if not mask.any():
                continue
            if np.any(np.abs(longitude[mask]) > 5) or np.any(np.abs(latitude[mask]) > 5):
                raise ValueError('Inputs must cover the same small field, within five degrees of the first image center')
            if len(result) >= MAX_LAYERS:
                raise ValueError(f'Model exceeds {MAX_LAYERS} layers; reduce --planes or the number of inputs')
            values = data[mask]
            threshold = np.percentile(values, percentile)
            indices = np.flatnonzero(values >= threshold)
            if indices.size > 3500:
                indices = indices[np.linspace(0, indices.size - 1, 3500, dtype=int)]
            points = np.column_stack((longitude[mask][indices] * 3600, latitude[mask][indices] * 3600, values[indices]))
            result.append({**metadata, 'points': points.tolist()})
    if not result:
        raise ValueError('No usable FITS samples found')
    if sum(len(layer['points']) for layer in result) > MAX_POINTS:
        budget = MAX_POINTS // len(result)
        for layer in result:
            points = layer['points']
            if len(points) > budget:
                layer['points'] = [points[index] for index in np.linspace(0, len(points) - 1, budget, dtype=int)]
    return dict(version=1, target=target, synthetic=False, percentile=percentile,
                center_icrs_deg=[float(origin.ra.deg), float(origin.dec.deg)], layers=result)


def main():
    """Write a local JSON model for the browser viewer."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', action='append', nargs=3, required=True,
                        metavar=('FITS', 'HDU', 'MICRONS_OR_AUTO'))
    parser.add_argument('--target', required=True)
    parser.add_argument('--planes', type=int, default=24, help='Maximum sampled planes per cube')
    parser.add_argument('--percentile', type=float, default=90)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if not 2 <= args.planes <= MAX_LAYERS or not 0 <= args.percentile < 100:
        parser.error('Use 2–64 planes and a percentile from 0 up to (but excluding) 100')
    if args.output.suffix.lower() != '.json':
        parser.error('--output must end in .json')
    try:
        model = convert(args.input, args.planes, args.percentile, args.target)
        with args.output.open('x', encoding='utf-8') as output:
            json.dump(model, output, allow_nan=False, separators=(',', ':'))
    except (OSError, ValueError, IndexError, KeyError, TypeError) as error:
        parser.exit(1, f'{error}\n')
    print(f"Wrote {len(model['layers'])} layers to {args.output}")


if __name__ == '__main__':
    main()
