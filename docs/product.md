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
The compact location fields have origin and destination markers connected by dots to their left.
An empty field shows its From or To label inside; focus replaces the label with a search icon and
a location hint. Entered text takes the label's place, and an inline control clears it. A staggered
up/down arrow beside the fields swaps their values and explains the action on hover or focus.
Recent route searches appear in equal-width pills beneath the fields. Long names end with an
ellipsis; hovering over or focusing a pill shows the full route. Selecting a pill reruns that route
with its latest saved departure choice.
If its chosen date has passed, the pill uses Leave now.
After a search, the form stays visible beside a separate results card on desktop. On mobile, results
follow the form, and an off-screen results card scrolls into view. The first search gently moves the
form into place and reveals the results card; direct links and later updates appear immediately.
People who prefer reduced motion see the final layout without an entrance animation. Results update when both
locations are selected or a date or departure time is committed. Editing a location keeps the
results card visible while the next selection is incomplete.
Search URLs preserve the selected places or stops and departure mode, with a date and optional time
for Depart at, so a link can open the same local results. Leave now is the default and uses the
current Cádiz time; Depart at reveals matching date and time pills beside the selector when space
permits. When they cannot fit beside it, both pills move to the next row together; they can wrap
within that row on narrow screens. The results card reveals earlier or later journeys in small groups
without leaving the page.
The date and time pills keep a stable width as their values change. The date pill can move one day at
a time within the saved timetable. The time pill accepts an exact typed time or a choice from a full
list of half-hour times. Its arrows move by 15 minutes and update the selected date when they cross
midnight. Compact entries such as `3` and `1330` become `15:00` and `13:30` when the field loses
focus; an unrecognized entry leaves departure time unset.
