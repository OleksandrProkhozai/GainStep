import { NotFoundView } from "@/components/app-shell/not-found-view";

/** Неіснуючий URL або notFound() поза каркасом застосунку. */
export default function NotFound() {
  return <NotFoundView fullPage />;
}
