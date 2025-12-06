import { CSSProperties } from "react"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  // Detect theme based on dark-theme class on #app element
  const getTheme = (): ToasterProps["theme"] => {
    if (typeof document !== "undefined") {
      const appRoot = document.getElementById("app")
      return appRoot?.classList.contains("dark-theme") ? "dark" : "light"
    }
    return "light"
  }

  return (
    <Sonner
      theme={getTheme()}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--color-bg-overlay)",
          "--normal-text": "var(--color-fg)",
          "--normal-border": "var(--color-neutral-6)",
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
