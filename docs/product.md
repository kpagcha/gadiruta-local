# Product

## Purpose

Gadiruta Local helps people explore public transport in Cádiz and the surrounding area. It is a
focused alternative to broad travel planners, built around the information needed for everyday
local trips.

## Intended experience

The app should be fast, friendly, mobile-first, and easy to scan. Its core tasks are:

- choose origin and destination places such as Cádiz, San Fernando, El Puerto de Santa María, or
  Jerez, or choose an exact physical stop;
- find scheduled direct services for a chosen date and optional departure time, then browse them in
  manageable groups;
- revisit recent routes or share a search URL;
- browse lines, stops, and timetables;
- view useful network information and relevant service notices.

Places are names people recognize when describing an area; stops are exact boarding points. A plain
municipality name selects its matching town area when one is available, while an explicit all-stops
choice covers the municipality. Search also reveals its served local areas and the town area's stops;
people can choose a named local area or an exact stop. A direct journey is one
scheduled trip that serves the origin before the destination; transfer routing is not part of the
first product.

The interface supports English and Spanish. Official place, operator, and line names remain as
provided by their source.

## Product boundaries

The first product does not include transfer routing, street-address routing, walking or driving
directions, flights, payments, accounts, push notifications, full-Andalusia coverage, or a custom
general-purpose routing algorithm.

## Design direction

The visual language is spacious and calm: strong typography, generous whitespace, comfortable
controls, restrained colour, and one clear task at a time. The inspiration from
[clicks.coffee](https://clicks.coffee/) is directional, not a template to copy.

On mobile, the origin and destination search must be visible on arrival without scrolling past
introductory copy. Desktop can pair that search with a larger editorial introduction.

The search form stays visible when results appear, beside the results card on desktop and above it
on mobile. Controls should work with keyboard and touch. Transitions should respect reduced-motion
preferences.
