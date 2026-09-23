/** A reviewed, rider-facing place that can be selected independently of a physical stop. */
export interface Place {
  id: string;
  name: string;
}

/**
 * Places served by the current Bahía snapshot, using stable app IDs instead of CTAN hierarchy IDs.
 *
 * These names are curated search choices. Their presence does not assign any stop to a place.
 */
export const places: readonly Place[] = [
  { id: 'arcos-de-la-frontera', name: 'Arcos de la Frontera' },
  { id: 'barrio-jarana', name: 'Barrio Jarana' },
  { id: 'cadiz', name: 'Cádiz' },
  { id: 'campus-universitario', name: 'Campus Universitario' },
  { id: 'chiclana-de-la-frontera', name: 'Chiclana de la Frontera' },
  { id: 'chipiona', name: 'Chipiona' },
  { id: 'conil-de-la-frontera', name: 'Conil de la Frontera' },
  { id: 'costa-ballena', name: 'Costa Ballena' },
  { id: 'costa-oeste', name: 'Costa Oeste' },
  { id: 'el-colorado', name: 'El Colorado' },
  { id: 'el-marquesado', name: 'El Marquesado' },
  { id: 'el-puerto-de-santa-maria', name: 'El Puerto de Santa María' },
  { id: 'jerez-de-la-frontera', name: 'Jerez de la Frontera' },
  { id: 'jedula', name: 'Jédula' },
  { id: 'medina-sidonia', name: 'Medina Sidonia' },
  { id: 'puerto-real', name: 'Puerto Real' },
  { id: 'rio-san-pedro', name: 'Río San Pedro' },
  { id: 'rota', name: 'Rota' },
  { id: 'san-fernando', name: 'San Fernando' },
  { id: 'sanlucar-de-barrameda', name: 'Sanlúcar de Barrameda' },
];
