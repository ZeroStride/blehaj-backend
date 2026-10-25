/// <reference types="web-bluetooth" />
import Layout from "@public/layouts"
import BleConnect from "@server/BleConnect"

import { useMachine } from "@xstate/react"
import { Scanner } from "@yudiel/react-qr-scanner"
import { createRoot } from "react-dom/client"
import { parse as parseUuid } from "uuid"
import { assign, setup } from "xstate"

interface AppConfiguration {
  serviceUuid: string | null
  characteristicUuid: string | null
}

interface AppContext {
  serviceUuid: string | null
  characteristicUuid: string | null
  characteristic?: BluetoothRemoteGATTCharacteristic
}

const appMachine = setup({
  types: {
    context: {} as AppContext,
    input: {} as AppConfiguration,
  },
  guards: {
    configurationValid: ({ context, event }) => {
      let ret = false
      try {
        parseUuid(context.serviceUuid || event.serviceUuid)
        parseUuid(context.characteristicUuid || event.characteristicUuid)
        ret = true
      } catch {}
      return ret
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
  always: {
    target: ".configured",
    guard: "configurationValid",
  },
  states: {
    initialized: {
      on: {
        configure: {
          actions: assign({
            serviceUuid: ({ event }) => event.serviceUuid,
            characteristicUuid: ({ event }) => event.characteristicUuid,
          }),
          target: "configured",
          guard: "configurationValid",
        },
      },
    },
    configured: {
      entry: ({ context }) => {
        history.replaceState({}, "", context.serviceUuid)
      },
      on: {
        "system.success": {
          target: "query_gatt",
          actions: assign({
            characteristic: ({ event }) => event.characteristic,
          }),
        },
        // "system.error": "connect_error",
      },
    },
    query_gatt: {},
  },
})

function App() {
  const CONFIGURATION_CHARACTERISTIC_UUID =
    "4b3bd2c3-2560-4353-8d37-05ca8333d01e"

  const [app, send] = useMachine(appMachine, {
    input: {
      serviceUuid:
        window.location.pathname.split("/")[1] ||
        new URLSearchParams(window.location.search).get("uuid"),
      characteristicUuid: CONFIGURATION_CHARACTERISTIC_UUID,
    },
  })

  switch (app.value) {
    case "initialized":
      return (
        <div className="mx-auto w-2/5">
          <div>
            <Scanner
              onScan={(result) => {
                console.log(result)
                for (var i = result.length - 1; i >= 0; i--) {
                  try {
                    parseUuid(result[i].rawValue)
                    send({ type: "configure", serviceUuid: result[i].rawValue })
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
          </div>

          <form
            action={(formData) => {
              const data = Object.fromEntries(formData.entries())
              send({ type: "configure", serviceUuid: data.uuid })
            }}
          >
            <input className="bg-violet-50" name="uuid" />
            <input type="submit" hidden />
          </form>
        </div>
      )
    case "configured":
      return (
        <div>
          <p className="text-gray-500">{app.context.serviceUuid}</p>
          <BleConnect
            serviceUuid={app.context.serviceUuid!}
            characteristicUuid={app.context.characteristicUuid!}
            onCharacteristic={(characteristic) =>
              send({ type: "system.success", characteristic })
            }
          />
        </div>
      )
    case "query_gatt":
      console.log(app.context.characteristic)
      return <div>gotta go do the thing</div>
  }
}

const root = createRoot(document.getElementById("elysia")!)
root.render(
  <Layout className="gap-6">
    <div className="mx-auto flex flex-col gap-x-4 rounded-xl p-6 shadow-lg outline outline-violet/5 bg-slate-800 -outline-offset-1 outline-white/10">
      <div className="text-center">
        <p className="text-3xl text-violet-50">
          🦈 <code>blehaj</code>
        </p>
      </div>
      <div>
        <App />
      </div>
    </div>
  </Layout>
)
