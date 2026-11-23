/**
 * The empty-state figure is one line drawing from @lucasmarkes/hairline, through its plain
 * DOM entry. The package's "/react" entry is never imported.
 *
 * Colours come from the app's tokens. interaction.css sets the six `--hairline-*`
 * properties on `.figure`, so the drawing follows the dark and light themes with no script.
 * The figure answers the pointer, which is the package's own behaviour. Under reduced
 * motion the stylesheet turns its pointer events off, so it rests.
 */
import { drawer } from "@lucasmarkes/hairline"

/** Draws into `host`. Returns the function that removes what it added. */
export const attachEmptyFigure = (host: HTMLElement, label: string): (() => void) => {
  const figure = drawer(host, { label })
  return () => figure.destroy()
}
