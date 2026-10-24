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
    <>
      {uuid ? (
        <BleConnect
          service_uuid={uuid}
          characteristic_uuid={CONFIGURATION_CHARACTERISTIC_UUID}
        />
      ) : (
        <div>
          no uuid provided via querystring or path, can't really do the thing
          todo: input manually or via QR reader
        </div>
      )}
    </>
  )
}

const root = createRoot(document.getElementById("elysia")!)
root.render(
  <Layout className="gap-6">
    <App />
  </Layout>
)
