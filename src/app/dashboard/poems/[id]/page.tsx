import { PoemEditor } from "../_components/poem-editor";

export default async function EditPoemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PoemEditor poemId={id} />;
}
