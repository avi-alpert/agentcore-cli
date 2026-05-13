import { CopilotChat, CopilotKitProvider } from '@copilotkit/react-core/v2';
import '@copilotkit/react-core/v2/styles.css';

export default function App() {
  return (
    <CopilotKitProvider runtimeUrl="http://localhost:3001/copilotkit">
      <CopilotChat agentId="default" className="h-screen" />
    </CopilotKitProvider>
  );
}
