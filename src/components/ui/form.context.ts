import { createContext, useId } from "react"

export type FormFieldContextValue = {
  name: string
}

export const FormFieldContext = createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
)

export type FormItemContextValue = {
  id: string
}

export const FormItemContext = createContext<FormItemContextValue>(
  {} as FormItemContextValue
)

export function useFormItem() {
  const id = useId()
  return { id }
}
