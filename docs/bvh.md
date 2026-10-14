# BVH traversal

The CPU now builds a simple Bounding Volume Hierarchy from the triangle list.
The GPU uploads the nodes, triangle index list, and triangle data.

## What changes in the kernel

Instead of testing every triangle, the kernel uses a stack-based BVH
traversal. It enters a node only if its box is hit.

## Why this matters

This is the base for real performance. Later work moves BVH construction
to the GPU and improves split quality.

## Current limits

- CPU built BVH only.
- Simple median splits.
- Fixed workgroup and stack sizes.
