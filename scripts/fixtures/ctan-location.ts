/** A representative CTAN Bahía response chain captured from its municipality, núcleo, and stop endpoints. */
export const ctanLocationFixture = {
  municipalities: [{ idMunicipio: '1', datos: 'Cádiz' }],
  nuclei: [{ idNucleo: '1', idMunicipio: '1', idZona: 'A', nombre: 'Cádiz' }],
  stops: [
    {
      idParada: '303',
      idNucleo: '1',
      idZona: 'A',
      nombre: 'Av. Astilleros-Estación Autobuses',
      latitud: '36.52731210460236',
      longitud: '-6.28530889749527',
      idMunicipio: '1',
      municipio: 'Cádiz',
      nucleo: 'Cádiz',
    },
  ],
} as const;
