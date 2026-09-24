# Product

## Purpose

Gadiruta Local helps people explore public transport in Cádiz and the surrounding area. It is a
focused alternative to broad travel planners, built around the information needed for everyday
local trips.

## Intended experience

The app should be fast, friendly, mobile-first, and easy to scan. Its core tasks are:

- choose origin and destination places such as Cádiz, San Fernando, El Puerto de Santa María, or
  Jerez, or choose an exact physical stop;
- find scheduled direct services for a chosen date and optional departure time;
- browse lines, stops, and timetables;
- view useful network information and relevant service notices.

Places are names people recognize when describing an area; stops are exact boarding points. Search
offers both without presenting administrative categories to riders. A direct journey is one
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
After a search, the form stays visible beside a separate results card on desktop. On mobile, results
follow the form, and an off-screen results card scrolls into view. Results update when both
locations are selected or a date or departure time is committed. Editing a location keeps the
results card visible while the next selection is incomplete.
Search URLs preserve the selected places or stops, date, and optional departure time so a link can
open the same local results. The date and time controls are separate pills, and the results card
reveals earlier or later journeys in small groups without leaving the page.
The time pill accepts an exact typed time or a choice from a full list of half-hour times. Its
arrows move by 15 minutes and update the selected date when they cross midnight. Compact entries
such as `3` and `1330` become `15:00` and `13:30` when the field loses focus; an unrecognized
entry leaves departure time unset.
