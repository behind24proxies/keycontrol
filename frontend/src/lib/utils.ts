import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001/api'

export async function copyToClipboard(text: string) {
  if (navigator && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch (err) {
      console.warn("Clipboard API failed, falling back to execCommand", err)
    }
  }
  
  // Fallback for non-secure contexts (like HTTP)
  const textArea = document.createElement("textarea")
  textArea.value = text
  
  // Avoid scrolling to bottom
  textArea.style.top = "0"
  textArea.style.left = "0"
  textArea.style.position = "fixed"
  textArea.style.opacity = "0"
  
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  
  try {
    document.execCommand('copy')
  } catch (err) {
    console.error('Fallback copy failed', err)
  }
  
  document.body.removeChild(textArea)
}
