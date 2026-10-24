import Layout from '@public/layouts';

import { useState } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
	const [count, setCount] = useState(0)
	const increase = () => setCount((c) => c + 1)

	return (
		<>
			<h1 className="text-3xl">Bun/Elysia Fullstack</h1>
			<h2 className="text-6xl">{count}</h2>
			<button
				className="text-xl text-blue-500 px-6 py-2 bg-blue-100 rounded-xl"
				onClick={increase}
			>
				Increase
			</button>
		</>
	)
}

const root = createRoot(document.getElementById('elysia')!)
root.render(
	<Layout className="gap-6">
		<App />
	</Layout>
)
