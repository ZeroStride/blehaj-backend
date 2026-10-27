// This is a random uuidv4, it's nothing special
const NETWORK_MANAGER_ID_NAMESPACE = "4c411299-551a-4fa2-b6e1-b26fef412004"

export type DbusVariant = {
  readonly signature: string
  readonly value: string | boolean | Uint8Array
}

export type DbusRecord = { [key: string]: DbusVariant | DbusRecord }

// https://networkmanager.dev/docs/api/latest/ref-settings.html
export class NetworkManagerConnectionBuilder {
  private settings: DbusRecord

  private constructor() {
    this.settings = {
      ipv4: {
        method: {
          signature: "s",
          value: "auto",
        },
      },
      ipv6: {
        method: {
          signature: "s",
          value: "auto",
        },
      },
    }
  }

  build(): DbusRecord {
    return this.settings
  }

  // https://networkmanager.dev/docs/api/latest/settings-802-11-wireless.html
  static wireless802_11(ssid: string): NetworkManagerConnectionBuilder {
    const builder = new NetworkManagerConnectionBuilder()
    builder.settings["connection"] = {
      uuid: {
        signature: "s",
        value: Bun.randomUUIDv5(ssid, NETWORK_MANAGER_ID_NAMESPACE),
      },
      autoconnect: {
        signature: "b",
        value: true,
      },
      id: {
        signature: "s",
        value: ssid,
      },
      type: {
        signature: "s",
        value: "802-11-wireless",
      },
    }
    builder.settings["802-11-wireless"] = {
      ssid: {
        signature: "s",
        value: ssid,
      },
      mode: {
        signature: "s",
        value: "infrastructure",
      },
    }
    return builder
  }

  // https://networkmanager.dev/docs/api/latest/settings-802-11-wireless-security.html
  withWPA_PSK(password: string): NetworkManagerConnectionBuilder {
    if (!this.settings["802-11-wireless"]) {
      throw new TypeError(
        "'withWPA_PSK' only valid for builders created with 'wireless802_11'"
      )
    }
    this.settings["802-11-wireless-security"] = {
      "key-mgmt": {
        signature: "s",
        value: "wpa-psk",
      },
      psk: {
        signature: "s",
        value: password,
      },
    }
    return this
  }
}
