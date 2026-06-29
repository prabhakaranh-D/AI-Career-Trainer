import { BarLoader } from "react-spinners";

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-50">
      <BarLoader className="mt-4" width={"100%"} color="#36d7b7" />
    </div>
  );
}
