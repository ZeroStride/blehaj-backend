import "@fontsource/fira-code"
import GitHubIcon from "@mui/icons-material/GitHub"
import {
  createTheme,
  CssBaseline,
  IconButton,
  Paper,
  Stack,
  Step,
  StepIcon,
  StepLabel,
  Stepper,
  styled,
  ThemeProvider,
  Typography,
} from "@mui/material"
import Box from "@mui/material/Box"
import { useMachine } from "@xstate/react"
import { MuiMarkdown } from "mui-markdown"
import React from "react"
import { createRoot } from "react-dom/client"
import { setup, StateFrom, types } from "xstate"
import { z } from "zod"

import BleConnect from "@components/BleConnect"
import BlehajAppBar from "@components/BlehajAppBar"
import ConfigureWiFi from "@components/ConfigureWiFi"
import ReadConfigurationRequest from "@components/ReadConfigurationRequest"
import WelcomeAndUuidInput, {
  uuidOrUndefined,
} from "@components/WelcomeAndUuidInput"

interface AppContext {
  characteristicUuid: string | null
  serviceUuid?: string
  characteristic?: BluetoothRemoteGATTCharacteristic
  session?: string
}

const appMachine = setup({
  schemas: {
    context: types<AppContext>(),
    input: z.object({
      serviceUuid: z.optional(z.uuid()),
      characteristicUuid: z.uuid(),
    }),
    events: {
      "input.serviceUuid": z.object({ serviceUuid: z.uuid() }),
      "system.connected": types<{
        characteristic: BluetoothRemoteGATTCharacteristic
      }>(),
      "internal.configured": z.object({}),
      "system.reset": z.object({}),
      "system.request_configuration": z.object({
        configuration_parameters: z.string(),
        session: z.uuidv7(),
      }),
      "system.complete": z.object({ confirmation: z.any() }),
    },
  },
}).createMachine({
  context: ({ input }) => {
    return {
      serviceUuid: input.serviceUuid,
      characteristicUuid: input.characteristicUuid,
    }
  },
  id: "app",
  initial: "initialized",
  states: {
    initialized: {
      on: {
        "input.serviceUuid": ({ event }) => ({
          context: { serviceUuid: event.serviceUuid },
          target: "configured",
        }),
        "internal.configured": { target: "configured" },
      },
      entry: ({ context, event }, enq) => {
        if (context.serviceUuid && context.characteristicUuid) {
          enq.raise(
            { type: "internal.configured" },
            // delay: 0 on reset so there's a tick inbetween and the UI can refresh
            event.type === "system.reset" ? { delay: 0 } : {}
          )
        }
      },
    },
    configured: {
      description: "Connect to Device",
      entry: ({ context }) => {
        history.replaceState({}, "", context.serviceUuid)
      },
      on: {
        "system.connected": ({ event }) => ({
          context: { characteristic: event.characteristic },
          target: "query_gatt",
        }),
        "system.reset": {
          target: "initialized",
        },
      },
    },
    query_gatt: {
      description: "Configuration Request",
      on: {
        "system.request_configuration": ({ event }) => {
          if (event.configuration_parameters !== "wifi") {
            throw new Error(
              `Don't know how to configure ${event.configuration_parameters}`
            )
          }

          return {
            context: { session: event.session },
            target: "configure_wifi",
          }
        },
      },
    },
    configure_wifi: {
      description: "Gather Information",
      on: {
        "system.complete": {
          target: "done",
        },
      },
    },
    done: {
      description: "Device Configured",
      final: true,
    },
  },
})

const stateOrder = ["configured", "query_gatt", "configure_wifi", "done"]

function CommonThingy({
  snapshot,
}: {
  snapshot: StateFrom<typeof appMachine>
}) {
  // Ok I give up for now. IDK how to make active/complete ones the secondary color
  const StyledStepIcon = styled(StepIcon)(({ theme }) => ({
    // color: (theme.vars ?? theme).palette.secondary.main,
  }))

  const activeStep = stateOrder.findIndex((v) => v === snapshot.value)
  const steps = stateOrder.map((v) => snapshot.machine.states[v].description)

  return (
    <Stack>
      <Stepper activeStep={activeStep} alternativeLabel>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel slots={{ stepIcon: StyledStepIcon }} error={false}>
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Stack>
  )
}

function App() {
  const CONFIGURATION_CHARACTERISTIC_UUID =
    "4b3bd2c3-2560-4353-8d37-05ca8333d01e"

  const [app, send] = useMachine(appMachine, {
    input: {
      characteristicUuid: CONFIGURATION_CHARACTERISTIC_UUID,
      serviceUuid: uuidOrUndefined(
        window.location.pathname.split("/")[1] ||
          new URLSearchParams(window.location.search).get("uuid")
      ),
    },
  })

  const [noWaitMode, setNoWaitMode] = React.useState(
    localStorage.getItem("noWaitMode") === "true"
  )
  localStorage.setItem("noWaitMode", noWaitMode ? "true" : "false")

  const TodoRefactorComponent = () => {
    switch (app.value) {
      case "initialized":
        return (
          <WelcomeAndUuidInput
            onUuid={(uuid, simulate) => {
              history.pushState({}, "", uuid)
              send({
                type: "input.serviceUuid",
                serviceUuid: uuid,
              })
            }}
          />
        )
      case "configured":
        return (
          <BleConnect
            {...{ noWaitMode }}
            {...app.context}
            onCharacteristic={(characteristic) => {
              send({ type: "system.connected", characteristic })
            }}
            onError={(error) => {
              console.error(error)
              send({ type: "system.reset" })
            }}
          />
        )
      case "query_gatt":
        return (
          <ReadConfigurationRequest
            {...{ noWaitMode }}
            {...app.context}
            onComplete={(json) =>
              send({
                type: "system.request_configuration",
                configuration_parameters: json.configuration_parameters,
                session: json.session,
              })
            }
          />
        )
      case "configure_wifi":
        return (
          <ConfigureWiFi
            {...{ noWaitMode }}
            {...app.context}
            session={app.context.session!}
            onComplete={(confirmation) => {
              console.log("all done", confirmation)
              send({ type: "system.complete", confirmation: confirmation })
            }}
          />
        )
      case "done":
        return (
          <MuiMarkdown>
            All done! Thanks for letting me show you how `blehaj` works! If you
            have any questions, let me know.
          </MuiMarkdown>
        )
    }
  }

  const Item = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(1),
    color: (theme.vars ?? theme).palette.text.secondary,
  }))

  return (
    <Box
      sx={{
        my: 2,
        mx: "auto",
        maxWidth: 800,
        minWidth: 400,
        width: 2 / 3,
      }}
    >
      <Stack spacing={1} sx={{ width: 1 }}>
        <BlehajAppBar {...{ noWaitMode, setNoWaitMode }} />
        {app.value !== "initialized" && <CommonThingy snapshot={app} />}
        <Item>
          <TodoRefactorComponent />
          <Typography
            variant="caption"
            component="div"
            sx={{ textAlign: "right", pt: 0.5 }}
          >
            {app.context.serviceUuid}
          </Typography>
        </Item>
        {noWaitMode && (
          <Stack direction="row" spacing={1}>
            <Typography variant="caption" sx={{ textAlign: "right" }}>
              'No Wait Mode' is enabled, this means the UI won't give you a
              chance to pause, or wait for you to read descriptions of what's
              happening behind the scenes.
            </Typography>
            <Typography variant="h3">⚡</Typography>
          </Stack>
        )}
      </Stack>
      <Stack direction={"row"} sx={{ justifyContent: "end", m: 1 }}>
        <IconButton
          aria-label="github"
          href="https://github.com/ZeroStride/blehaj-backend"
          target="_blank"
        >
          <GitHubIcon />
        </IconButton>
      </Stack>
    </Box>
  )
}

const theme = createTheme({
  palette: {
    primary: {
      main: "#b00c7c",
    },
    secondary: {
      main: "#a179f6",
    },
    mode: "dark",
    background: {
      default: "#05100a",
      paper: "#1a2027",
    },
  },
  typography: {
    fontWeightLight: 200,
    fontWeightRegular: 300,
    fontWeightMedium: 400,
    fontWeightBold: 600,
    fontSize: 14,
    fontFamily: "Fira Code",
  },
  spacing: 11,
  shape: {
    borderRadius: 6,
  },
})

const root = createRoot(document.getElementById("elysia")!)
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
)
