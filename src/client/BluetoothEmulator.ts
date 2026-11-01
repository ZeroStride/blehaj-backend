import { encode as encodeMsgpack } from "@msgpack/msgpack"

export const BluetoothDeviceEmulator: Partial<BluetoothDevice> = {
  _emulated: true,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  gatt: {
    connect: function (): Promise<Partial<BluetoothRemoteGATTServer>> {
      return Promise.resolve(BluetoothGattServerEmulator)
    },
  } as Partial<BluetoothRemoteGATTServer>,
}

const BluetoothGattServerEmulator: Partial<BluetoothRemoteGATTServer> = {
  _emulated: true,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  getPrimaryService: function (
    service: BluetoothServiceUUID
  ): Promise<Partial<BluetoothRemoteGATTService>> {
    return Promise.resolve(BluetoothGattServiceEmulator)
  },
}

const BluetoothGattServiceEmulator: Partial<BluetoothRemoteGATTService> = {
  _emulated: true,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  getCharacteristic: function (
    characteristic: BluetoothCharacteristicUUID
  ): Promise<Partial<BluetoothRemoteGATTCharacteristic>> {
    return Promise.resolve(BluetoothGattCharacteristicEmulator)
  },
}

const BluetoothGattCharacteristicEmulator: Partial<BluetoothRemoteGATTCharacteristic> =
  {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    _emulated: true,
    writeValueWithResponse: function (value: BufferSource) {
      return Promise.resolve()
    },
    readValue: function (): Promise<DataView> {
      const payload = encodeMsgpack({
        identifier: crypto.randomUUID(),
        algorithm: "ed25519",
        request: {
          NetworkManagerConfiguration: { interface: "wlan0" },
        },
      })
      const chonk = [
        3,
        encodeMsgpack({
          signature: "",
          payload,
        }),
      ]
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      return Promise.resolve(encodeMsgpack(chonk))
    },
  }
