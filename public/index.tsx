import "@fontsource/fira-code"
import {
  createTheme,
  CssBaseline,
  Paper,
  Stack,
  Step,
  StepIcon,
  StepLabel,
  Stepper,
  styled,
  ThemeProvider,
} from "@mui/material"
import Box from "@mui/material/Box"
import { useMachine } from "@xstate/react"
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
  nonce?: string
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
        nonce: z.uuidv7(),
      }),
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
            context: { nonce: event.nonce },
            target: "configure_wifi",
          }
        },
      },
    },
    configure_wifi: {
      description: "Gather Information",
    },
    done: {
      description: "Device Configured",
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
      {/*<Divider sx={{ mb: 0.5, pt: 1 }} />*/}
      {/*    <Typography variant="caption" component="div" sx={{ textAlign: "right" }}>
        {serviceUuid}
      </Typography>*/}
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
            serviceUuid={app.context.serviceUuid!}
            characteristicUuid={app.context.characteristicUuid!}
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
            characteristic={app.context.characteristic!}
            onComplete={(json) =>
              send({
                type: "system.request_configuration",
                configuration_parameters: json.configuration_parameters,
                nonce: json.nonce,
              })
            }
          />
        )
      case "configure_wifi":
        return (
          <ConfigureWiFi
            characteristic={app.context.characteristic!}
            nonce={app.context.nonce!}
            onComplete={(json) => console.log(json)}
          />
        )
    }
  }

  return (
    <Box
      sx={{
        my: 2,
        mx: "auto",
        maxWidth: 800,
        minWidth: 400,
        width: 2 / 3,
        boxShadow: 5,
      }}
    >
      <Stack spacing={1} sx={{ width: 1 }}>
        <BlehajAppBar />
        {app.value !== "initialized" && <CommonThingy snapshot={app} />}
        <Item>
          <TodoRefactorComponent />
        </Item>
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

const Item = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1),
  color: (theme.vars ?? theme).palette.text.secondary,
}))

const root = createRoot(document.getElementById("elysia")!)
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
)
