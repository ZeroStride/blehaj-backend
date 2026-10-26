/// <reference types="web-bluetooth" />
import { useMachine } from "@xstate/react"
import { Scanner } from "@yudiel/react-qr-scanner"
import { createRoot } from "react-dom/client"
import { parse as parseUuid } from "uuid"
import { setup, types } from "xstate"
import { z } from "zod"

import BleConnect from "@components/BleConnect"
import Layout from "@public/layouts"

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
        <div className="mx-auto w-2/5">
          <div>
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
          </div>

          <form
            action={(formData) => {
              const data = Object.fromEntries(formData.entries())
              send({ type: "input.serviceUuid", serviceUuid: data.uuid })
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
            onCharacteristic={(characteristic) => {
              send({ type: "system.connected", characteristic })
            }}
            onError={(error) => {
              console.log(error)
              send({ type: "system.reset" })
            }}
          />
        </div>
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
        <div className="px-2 py-1 rounded-xl bg-zinc-800 shadow-lg outline outline-violet/5">
          <p className="text-3xl text-violet-50">Talking to device...</p>
        </div>
      )
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
