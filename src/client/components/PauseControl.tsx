import PausePresentationIcon from "@mui/icons-material/PausePresentation"
import SlideshowIcon from "@mui/icons-material/Slideshow"
import { ToggleButton, ToggleButtonGroup } from "@mui/material"

export default function PauseControl({
  noWaitMode,
  paused,
  setPaused,
}: {
  noWaitMode: boolean
  paused: boolean
  setPaused: React.Dispatch<React.SetStateAction<boolean>>
}) {
  return (
    !noWaitMode && (
      <ToggleButtonGroup
        orientation="vertical"
        value={paused ? "pause" : "play"}
        color={paused ? "warning" : "secondary"}
        exclusive
        onChange={(_, value) => value && setPaused(value === "pause")}
      >
        <ToggleButton value="play" aria-label="play">
          <SlideshowIcon />
        </ToggleButton>
        <ToggleButton value="pause" aria-label="pause">
          <PausePresentationIcon />
        </ToggleButton>
      </ToggleButtonGroup>
    )
  )
}
