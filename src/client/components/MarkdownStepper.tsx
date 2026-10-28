import PauseControl from "@components/PauseControl"
import {
  Container,
  LinearProgress,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
} from "@mui/material"
import { MuiMarkdown } from "mui-markdown"

export default function MarkdownStepper({
  activeStep,
  waiting,
  steps,
  noWaitMode,
  paused,
  setPaused,
}: {
  activeStep: number
  waiting: boolean
  steps: Array<{ label: string; description: string }>
  noWaitMode: boolean
  paused: boolean
  setPaused: React.Dispatch<React.SetStateAction<boolean>>
}) {
  return (
    <Stepper activeStep={activeStep} orientation="vertical">
      {steps.map((step, index) => (
        <Step key={step.label}>
          <StepLabel>{step.label}</StepLabel>
          <StepContent sx={{ textAlign: "right" }}>
            <Stack direction="row" spacing={-2} sx={{ mr: -1 }}>
              <Container>
                <LinearProgress
                  color={
                    waiting ? (paused ? "warning" : "secondary") : "secondary"
                  }
                  aria-label="Waiting..."
                  variant={waiting ? "query" : "indeterminate"}
                />
                <MuiMarkdown>{step.description}</MuiMarkdown>
              </Container>
              <PauseControl {...{ noWaitMode }} {...{ paused, setPaused }} />
            </Stack>
          </StepContent>
        </Step>
      ))}
    </Stepper>
  )
}
