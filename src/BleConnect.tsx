import { useMachine } from "@xstate/react"
import { setup, types } from "xstate"

// Todo - Do validated schema for configuration
// z.uuid(), z.uuid() etc
export interface BleConnectConfiguration {
  readonly serviceUuid: BluetoothServiceUUID
  readonly characteristicUuid: BluetoothCharacteristicUUID
  readonly onCharacteristic?: (
    characteristic: BluetoothRemoteGATTCharacteristic
  ) => void
  readonly onError?: (error: Error) => void
}

interface BleConnectContext {
  readonly serviceUuid: BluetoothServiceUUID
  readonly characteristicUuid: BluetoothCharacteristicUUID
  device?: BluetoothDevice
  server?: BluetoothRemoteGATTServer
  service?: BluetoothRemoteGATTService
  characteristic?: BluetoothRemoteGATTCharacteristic
}

const handshake = setup({
  schemas: {
    context: types<BleConnectContext>(),
    input: types<BleConnectConfiguration>(),
    output: types<BluetoothRemoteGATTCharacteristic>(),
    events: {
      "system.success": types<{
        device?: BluetoothDevice
        server?: BluetoothRemoteGATTServer
        service?: BluetoothRemoteGATTService
        characteristic?: BluetoothRemoteGATTCharacteristic
      }>(),
      "user.initiate": types<{
        // Idk why this is required
        characteristic?: BluetoothRemoteGATTCharacteristic
      }>(),
    },
  },
}).createMachine({
  context: ({ input }) => {
    return {
      serviceUuid: input.serviceUuid,
      characteristicUuid: input.characteristicUuid,
    }
  },
  id: "handshake",
  initial: "ready",
  states: {
    ready: {
      on: { "user.initiate": ({ event }) => ({ target: "request_device" }) },
    },
    request_device: {
      on: {
        "system.success": ({ event }) => ({
          context: { device: event.device },
          target: "connect_gatt",
        }),
      },
    },
    connect_gatt: {
      on: {
        "system.success": ({ event }) => ({
          target: "get_service_gatt",
          context: { server: event.server },
        }),
      },
    },
    get_service_gatt: {
      on: {
        "system.success": ({ event }) => ({
          target: "get_charactaristic_gatt",
          context: { service: event.service },
        }),
      },
    },
    get_charactaristic_gatt: {
      on: {
        "system.success": {
          target: "success",
        },
      },
    },
    success: {
      type: "final",
      output: ({ event }) => event.characteristic!,
    },
  },
})

export default function BleConnect({
  serviceUuid,
  characteristicUuid,
  onCharacteristic,
  onError,
}: BleConnectConfiguration) {
  const [state, send, actor] = useMachine(handshake, {
    input: {
      serviceUuid,
      characteristicUuid,
    },
  })

  actor.subscribe({
    error: (error) => onError,
    complete: () => {
      onCharacteristic?.call(null, state.output!)
    },
  })

  const connect = () => {
    send({ type: "user.initiate" })
    navigator.bluetooth
      .requestDevice({
        filters: [{ services: [state.context.serviceUuid] }],
      })
      .then((device) => {
        send({ type: "system.success", device })
        return device.gatt?.connect()
      })
      .then((server) => {
        send({ type: "system.success", server })
        return server?.getPrimaryService(state.context.serviceUuid)
      })
      .then((service) => {
        send({ type: "system.success", service })
        return service?.getCharacteristic(state.context.characteristicUuid)
      })
      .then((characteristic) => {
        send({ type: "system.success", characteristic })
      })
  }

  return (
    <div className="flex flex-col gap-x-4 pt-2">
      {state.value === "ready" ? (
        <button
          className="text-xl text-violet-500 px-6 py-2 bg-blue-100 rounded-xl"
          onClick={connect}
        >
          Connect
        </button>
      ) : (
        <div className="px-2 py-1 rounded-xl bg-zinc-800 shadow-lg outline outline-violet/5">
          <p className="text-3xl text-violet-50">
            State: {state.value.toString()}
          </p>
          <p className="text-s text-rose-300">{state.error?.toString()}</p>
        </div>
      )}
    </div>
  )
}
