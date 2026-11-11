---
version: alpha
name: Stripe Slate & Cobalt
description: Bright Slate surfaces and Cobalt interactions for B2B Fintech and SaaS.
colors:
  primary: '#0F172A'
  secondary: '#64748B'
  tertiary: '#2563EB'
  neutral: '#F8FAFC'
  surface: '#FFFFFF'
  on-primary: '#FFFFFF'
  border: '#E2E8F0'
  accent-hover: '#1D4ED8'
  accent-soft: '#EFF6FF'
  accent-border: '#BFDBFE'
  edge: '#94A3B8'
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif'
    fontSize: 1.875rem
    fontWeight: 700
    lineHeight: 1.25
  h1:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif'
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 2rem
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif'
    fontSize: 0.875rem
    lineHeight: 1.55
  label:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    fontSize: 0.72rem
rounded:
  sm: 3px
  md: 8px
  lg: 16px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 32px
  xl: 64px
components:
  button-primary:
    backgroundColor: '{colors.tertiary}'
    textColor: '{colors.on-primary}'
    rounded: 6px
    padding: 7px 14px
  card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.primary}'
    rounded: 12px
    padding: 16px
---

## Overview

Stripe Slate & Cobalt draws on Stripe, Retool, Airplane, and Tailwind UI for a clear, trustworthy B2B Fintech and SaaS interface.
Cool Slate backgrounds and thin borders frame white surfaces, with Cobalt marking the actions and selections that matter.
The palette suits product roadmaps presented to executives, investors, and enterprise customers.

## Colors

- **Primary `#0F172A`** for headings and core text.
- **Secondary `#64748B`** for descriptions, labels, and metadata.
- **Tertiary `#2563EB`** for primary buttons, connection points, and selected node borders, with `#1D4ED8` on hover for buttons and connection points.
- **Neutral `#F8FAFC`** for the roadmap canvas.
- **Surface `#FFFFFF`** for nodes, cards, and other raised surfaces.
- **Border `#E2E8F0`** for node outlines and dividers.
- **Edge `#94A3B8`** for connectors, switching to Cobalt `#2563EB` when selected.

## Typography

- **Display** uses system sans at `1.875rem` and weight 700.
- **Heading** uses system sans at `1.5rem` and weight 700.
- **Body** uses system sans at `0.875rem` with a line height of 1.55.
- **Label** uses system monospace at `0.72rem` for compact metadata.

## Do's and Don'ts

- **Do** reserve solid Cobalt for the main action and use it to mark selected nodes or edges.
- **Do** use white surfaces and thin Slate borders to keep the graph legible.
- **Do** provide visible keyboard focus and label interactive controls.
- **Avoid** gradients and competing accent colors.
