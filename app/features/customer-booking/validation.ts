import { z } from 'zod';
import { validWeight } from './exact-json';

export const uuid =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export const isUuid = (value: string) =>
  uuid.test(value) && value !== '00000000-0000-0000-0000-000000000000';

const required = z
  .string()
  .trim()
  .min(1, 'This field is required.')
  .refine((value) => !value.includes('\0'), 'Remove the invalid character.');
const zoneId = required.refine(isUuid, 'Choose a delivery area.');

export const bookingFormSchema = z.object({
  pickupStreet: required,
  pickupCity: required,
  pickupPostalCode: required,
  pickupZoneId: zoneId,
  deliveryStreet: required,
  deliveryCity: required,
  deliveryPostalCode: required,
  deliveryZoneId: zoneId,
  recipientName: required,
  recipientPhone: required,
  weightKg: z
    .string()
    .trim()
    .refine(
      validWeight,
      'Enter an exact weight greater than 0 and at most 30 kg.',
    ),
  size: z.enum(['Small', 'Medium', 'Large']),
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

export const emptyBookingForm: BookingFormValues = {
  pickupStreet: '',
  pickupCity: '',
  pickupPostalCode: '',
  pickupZoneId: '',
  deliveryStreet: '',
  deliveryCity: '',
  deliveryPostalCode: '',
  deliveryZoneId: '',
  recipientName: '',
  recipientPhone: '',
  weightKg: '',
  size: 'Small',
};
