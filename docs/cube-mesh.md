# Cube mesh

The scene now uses a cube generated from a small set of cube vertices and
face indices.

## Why a cube

A cube is small but shows more than one triangle. It is also enough to
check winding, shading, and BVH behavior.

## Winding

Each triangle is flipped when needed so its normal points away from the
cube center. This keeps basic shading readable.
