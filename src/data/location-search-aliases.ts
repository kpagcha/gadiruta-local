/**
 * Lists familiar English and Spanish searches for transport hubs in the reviewed network snapshot.
 * The browser attaches these terms to existing places and bus stops when it builds local suggestions.
 * Rail station entries identify bus boarding points at those stations, not train services.
 */

/** One set of search terms shared by the existing choices for a transport hub. */
export interface LocationAliasGroup {
  placeIds?: readonly string[];
  stopIds?: readonly string[];
  aliases: readonly string[];
}

export const locationAliasGroups: readonly LocationAliasGroup[] = [
  {
    placeIds: ['aeropuerto-jerez'],
    stopIds: ['2_173'],
    aliases: ['airport', 'Jerez airport'],
  },
  {
    stopIds: ['2_14', '2_303', '2_304'],
    aliases: ['Cádiz bus station', 'estación de autobuses Cádiz'],
  },
  {
    stopIds: ['2_161'],
    aliases: ['Jerez bus station', 'estación de autobuses Jerez'],
  },
  {
    stopIds: ['2_181'],
    aliases: ['Rota bus station', 'estación de autobuses Rota'],
  },
  {
    stopIds: ['2_188'],
    aliases: ['Medina Sidonia bus station', 'estación de autobuses Medina Sidonia'],
  },
  {
    stopIds: ['2_191'],
    aliases: ['Arcos de la Frontera bus station', 'estación de autobuses Arcos de la Frontera'],
  },
  {
    stopIds: ['2_222'],
    aliases: ['Sanlúcar de Barrameda bus station', 'estación de autobuses Sanlúcar de Barrameda'],
  },
  {
    stopIds: ['2_266'],
    aliases: ['Chipiona bus station', 'estación de autobuses Chipiona'],
  },
  {
    stopIds: ['2_125', '2_126'],
    aliases: ['El Puerto de Santa María train station', 'estación de tren El Puerto de Santa María'],
  },
  {
    stopIds: ['2_163', '2_174'],
    aliases: ['Jerez train station', 'estación de tren Jerez'],
  },
  {
    stopIds: ['2_47', '2_48'],
    aliases: [
      'San Fernando train station',
      'Bahía Sur train station',
      'estación de tren San Fernando',
      'estación de tren Bahía Sur',
    ],
  },
  {
    stopIds: ['2_86', '2_87'],
    aliases: ['Puerto Real train station', 'estación de tren Puerto Real'],
  },
];
