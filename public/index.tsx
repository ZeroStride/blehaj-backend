/// <reference types="web-bluetooth" />
import { useMachine } from "@xstate/react"
import { Scanner } from "@yudiel/react-qr-scanner"
import { createRoot } from "react-dom/client"
import { parse as parseUuid } from "uuid"
import { setup, types } from "xstate"
import { z } from "zod"

import BleConnect from "@components/BleConnect"

interface AppContext {
  characteristicUuid: string | null
  serviceUuid?: string
  characteristic?: BluetoothRemoteGATTCharacteristic
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
      on: {},
    },
  },
})

function App() {
  const CONFIGURATION_CHARACTERISTIC_UUID =
    "4b3bd2c3-2560-4353-8d37-05ca8333d01e"

  const [app, send] = useMachine(appMachine, {
    input: {
      characteristicUuid: CONFIGURATION_CHARACTERISTIC_UUID,
      serviceUuid:
        window.location.pathname.split("/")[1] ||
        new URLSearchParams(window.location.search).get("uuid") ||
        undefined,
    },
  })

  switch (app.value) {
    case "initialized":
      return (
        <Box>
          <Scanner
            onScan={(result) => {
              console.log(result)
              for (var i = result.length - 1; i >= 0; i--) {
                try {
                  parseUuid(result[i].rawValue)
                  send({
                    type: "input.serviceUuid",
                    serviceUuid: result[i].rawValue,
                  })
                  break
                } catch {}
              }
            }}
            classNames={{ video: "object-contain" }}
            components={{
              onOff: true,
              finder: true,
            }}
            sound={false}
          />

          <form
            action={(formData) => {
              const data = Object.fromEntries(formData.entries())
              send({ type: "input.serviceUuid", serviceUuid: data.uuid })
            }}
          >
            <input className="bg-violet-50" name="uuid" />
            <input type="submit" hidden />
          </form>
        </Box>
      )
    case "configured":
      return (
        <Box>
          <Typography variant="h6" component="div">
            {app.context.serviceUuid}
          </Typography>
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
        </Box>
      )
    case "query_gatt":
      app.context.characteristic
        ?.readValue()
        .then((value) => {
          const request = new Request("/api/configure", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/blehaj",
            },
            body: value.buffer as BodyInit,
          })
          return fetch(request)
        })
        .then((response) => console.log(response))
      return (
        <Box>
          <Typography variant="h4">Talking to device...</Typography>
        </Box>
      )
  }
}

import {
  AppBar,
  createTheme,
  CssBaseline,
  Paper,
  Stack,
  styled,
  ThemeProvider,
  Typography,
} from "@mui/material"
import Box from "@mui/material/Box"

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
      paper: "#05100a",
    },
  },
  typography: {
    fontWeightLight: 200,
    fontWeightRegular: 300,
    fontWeightMedium: 400,
    fontWeightBold: 600,
    fontSize: 15,
  },
  spacing: 11,
  shape: {
    borderRadius: 6,
  },
})

const Item = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1),
  textAlign: "right",
  color: (theme.vars ?? theme).palette.text.secondary,
  ...theme.applyStyles("dark", {
    backgroundColor: "#1A2027",
  }),
}))

const root = createRoot(document.getElementById("elysia")!)
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <Box
      sx={{
        my: 5,
        p: 2,
        mx: "auto",
        maxWidth: 800,
        width: 2 / 3,
        display: "flex",
        boxShadow: 5,
      }}
    >
      <Stack spacing={2} sx={{ width: 1 }}>
        <Item>
          <AppBar position="static" sx={{ flexDirection: "row" }}>
            <Typography
              variant="h3"
              component="div"
              sx={{ ml: 1, mr: 4, edge: "start" }}
            >
              🦈
            </Typography>
            <Typography variant="h3" component="div">
              blehaj
            </Typography>
          </AppBar>
        </Item>
        <Item>
          <App />
        </Item>
      </Stack>
    </Box>
  </ThemeProvider>
)
