import {
  LinearProgress,
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
}: {
  activeStep: number
  waiting: boolean
  steps: Array<{ label: string; description: string }>
}) {
  return (
    <Stepper activeStep={activeStep} orientation="vertical">
      {steps.map((step, index) => (
        <Step key={step.label}>
          <StepLabel>{step.label}</StepLabel>
          <StepContent sx={{ textAlign: "right" }}>
            {waiting ? (
              <LinearProgress color="secondary" aria-label="Loading..." />
            ) : (
              <LinearProgress
                color="secondary"
                aria-label="Waiting..."
                variant="query"
              />
            )}
            <MuiMarkdown>{step.description}</MuiMarkdown>
          </StepContent>
        </Step>
      ))}
    </Stepper>
  )
}
