import Layout from "@public/layouts"
import BleConnect from "@server/BleConnect"
import { createRoot } from "react-dom/client"

function App() {
  const CONFIGURATION_CHARACTERISTIC_UUID =
    "4b3bd2c3-2560-4353-8d37-05ca8333d01e"

  const queryParams = new URLSearchParams(window.location.search)
  const uuidParam = queryParams.get("uuid")
  const [_, uuidPath] = window.location.pathname.split("/")
  const uuid = uuidPath || uuidParam

  return (
    <div className="mx-auto flex flex-col gap-x-4 rounded-xl p-6 shadow-lg outline outline-violet/5 bg-slate-800 -outline-offset-1 outline-white/10">
      <div className="text-center">
        <p className="text-3xl text-violet-50">
          🦈 <code>blehaj</code> is ready to do a configure
        </p>
        <p className="text-gray-500">{uuid}</p>
      </div>
      {uuid ? (
        <BleConnect
          serviceUuid={uuid}
          characteristicUuid={CONFIGURATION_CHARACTERISTIC_UUID}
        />
      ) : (
        <div>
          no uuid provided via querystring or path, can't really do the thing
          todo: input manually or via QR reader
        </div>
      )}
    </div>
  )
}

const root = createRoot(document.getElementById("elysia")!)
root.render(
  <Layout className="gap-6">
    <App />
  </Layout>
)
