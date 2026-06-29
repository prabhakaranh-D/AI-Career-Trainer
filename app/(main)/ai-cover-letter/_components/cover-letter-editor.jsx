"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MDEditor from "@uiw/react-md-editor";
import { Download, Edit, Loader2, Monitor, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateCoverLetter } from "@/actions/cover-letter";
import useFetch from "@/hooks/use-fetch";

export default function CoverLetterEditor({ coverLetter }) {
    const router = useRouter();
    const [content, setContent] = useState(coverLetter?.content || "");
    const [mode, setMode] = useState("preview"); // "preview" | "edit"
    const [isGenerating, setIsGenerating] = useState(false);

    const {
        loading: isSaving,
        fn: updateFn,
    } = useFetch(updateCoverLetter);

    const handleSave = async () => {
        try {
            await updateFn(coverLetter.id, content);
            toast.success("Cover letter saved successfully!");
            router.refresh();
        } catch (error) {
            toast.error(error.message || "Failed to save cover letter");
        }
    };

    const handleDownloadPDF = async () => {
        setIsGenerating(true);
        try {
            const element = document.getElementById("cover-letter-pdf");
            if (!element) throw new Error("Content element not found");

            const opt = {
                margin: [15, 15],
                filename: `cover-letter-${coverLetter.jobTitle}-${coverLetter.companyName}.pdf`
                    .replace(/\s+/g, "-")
                    .toLowerCase(),
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            };

            const html2pdf = (await import("html2pdf.js/dist/html2pdf.min.js")).default;
            await html2pdf().set(opt).from(element).save();
        } catch (error) {
            console.error("PDF generation error:", error);
            toast.error("Failed to generate PDF. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div data-color-mode="light" className="space-y-4">
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 justify-end">
                <Button
                    variant="outline"
                    onClick={() => setMode(mode === "preview" ? "edit" : "preview")}
                >
                    {mode === "preview" ? (
                        <>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                        </>
                    ) : (
                        <>
                            <Monitor className="h-4 w-4 mr-2" />
                            Preview
                        </>
                    )}
                </Button>

                <Button
                    variant="destructive"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4 mr-2" />
                            Save
                        </>
                    )}
                </Button>

                <Button onClick={handleDownloadPDF} disabled={isGenerating}>
                    {isGenerating ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Generating PDF...
                        </>
                    ) : (
                        <>
                            <Download className="h-4 w-4 mr-2" />
                            Download PDF
                        </>
                    )}
                </Button>
            </div>

            {/* Editor */}
            <div className="border rounded-lg">
                <MDEditor
                    value={content}
                    onChange={setContent}
                    height={700}
                    preview={mode}
                />
            </div>

            {/* Off-screen element for PDF generation */}
            <div
                style={{
                    position: "absolute",
                    left: "-9999px",
                    top: 0,
                    width: "210mm",
                }}
            >
                <div
                    id="cover-letter-pdf"
                    style={{ background: "white", color: "black", padding: "20px" }}
                >
                    <MDEditor.Markdown
                        source={content}
                        style={{ background: "white", color: "black" }}
                    />
                </div>
            </div>
        </div>
    );
}
