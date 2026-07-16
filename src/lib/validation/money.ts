import { z } from 'zod'

const MONEY_MESSAGE = 'Ingresá un monto válido'

export const moneyAmountSchema = z
  .string()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/, MONEY_MESSAGE)

export const signedMoneyAmountSchema = z
  .string()
  .regex(/^-?\d{1,10}(?:\.\d{1,2})?$/, MONEY_MESSAGE)
