/**
 * Lists the place names people can search for, such as Cádiz and Rota.
 *
 * These names are maintained by the project and can be searched alongside exact bus stops.
 * CTAN identifiers link these names to the reviewed hierarchy; the stop relationships remain in
 * the static network snapshot.
 */
/** A reviewed, rider-facing place that can be selected independently of a physical stop. */
export interface Place {
  id: string;
  name: string;
  municipalityId?: string;
  localAreaId?: string;
}

/**
 * Places served by the current Bahía snapshot, using stable app IDs instead of CTAN hierarchy IDs.
 *
 * These names are curated search choices. CTAN IDs link them to the official location hierarchy;
 * stop membership comes from the reviewed network snapshot.
 */
export const places: readonly Place[] = [
  { id: 'arcos-de-la-frontera', name: 'Arcos de la Frontera', municipalityId: '10' },
  { id: 'barrio-jarana', name: 'Barrio Jarana', localAreaId: '11' },
  { id: 'cadiz', name: 'Cádiz', municipalityId: '1' },
  { id: 'campus-universitario', name: 'Campus Universitario', localAreaId: '41' },
  { id: 'chiclana-de-la-frontera', name: 'Chiclana de la Frontera', municipalityId: '3' },
  { id: 'chipiona', name: 'Chipiona', municipalityId: '15' },
  { id: 'conil-de-la-frontera', name: 'Conil de la Frontera', municipalityId: '16' },
  { id: 'costa-ballena', name: 'Costa Ballena (Rota)', localAreaId: '17' },
  { id: 'costa-oeste', name: 'Costa Oeste', localAreaId: '9' },
  { id: 'el-colorado', name: 'El Colorado', localAreaId: '46' },
  { id: 'el-marquesado', name: 'El Marquesado', localAreaId: '40' },
  { id: 'el-puerto-de-santa-maria', name: 'El Puerto de Santa María', municipalityId: '5' },
  { id: 'jerez-de-la-frontera', name: 'Jerez de la Frontera', municipalityId: '6' },
  { id: 'jedula', name: 'Jédula', localAreaId: '19' },
  { id: 'medina-sidonia', name: 'Medina Sidonia', municipalityId: '8' },
  { id: 'puerto-real', name: 'Puerto Real', municipalityId: '4' },
  { id: 'rio-san-pedro', name: 'Río San Pedro', localAreaId: '12' },
  { id: 'rota', name: 'Rota', municipalityId: '7' },
  { id: 'san-fernando', name: 'San Fernando', municipalityId: '2' },
  { id: 'sanlucar-de-barrameda', name: 'Sanlúcar de Barrameda', municipalityId: '11' },
];
