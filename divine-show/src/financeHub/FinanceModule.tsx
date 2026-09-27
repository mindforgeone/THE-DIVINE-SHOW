import type { User } from "firebase/auth";
import CapitalApp from "./CapitalApp";
import "./capital.css";

type FinanceModuleProps = {
  user: User;
  onExit: () => void;
  onCapitalChange: (value: number) => void;
};

export default function FinanceModule({
  user,
  onExit,
  onCapitalChange,
}: FinanceModuleProps) {
  return (
    <section className="capital-module" aria-label="Капитал">
      <CapitalApp
        embeddedUser={user}
        onExit={onExit}
        onCapitalChange={onCapitalChange}
      />
    </section>
  );
}
