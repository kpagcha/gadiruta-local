/**
 * Defines the reviewed location input read by the offline builder and coordinate research tool.
 * This is curated input, separate from CTAN's raw API responses. Parse it once when reading JSON;
 * the network contract checks the relationships copied into the final snapshot.
 */
import { z } from 'zod';
import { coordinateSchema, municipalitySchema } from '../../src/data/network-schema.ts';

const identifier = z.string().min(1);
const derivedCoordinatesSchema = z.object({
  stopCount: z.number().int().positive(),
  average: coordinateSchema,
  representativeStop: coordinateSchema.extend({ stopId: identifier }),
});

/** Keep review metadata and candidate points outside the application-facing snapshot shape. */
export const locationDirectorySchema = z.object({
  retrievedAt: z.string().min(1),
  municipalities: z.array(municipalitySchema.extend({ derivedCoordinates: derivedCoordinatesSchema.optional() })),
  localAreas: z.array(
    municipalitySchema.extend({
      municipalityId: identifier,
      derivedCoordinates: derivedCoordinatesSchema.optional(),
    }),
  ),
  stopLocations: z.record(identifier, z.object({ municipalityId: identifier, localAreaId: identifier.nullable() })),
});

/** The reviewed input shared by generation and coordinate derivation. */
export type LocationDirectory = z.infer<typeof locationDirectorySchema>;
