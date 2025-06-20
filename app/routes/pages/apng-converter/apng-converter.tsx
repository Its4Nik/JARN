import { useState, useEffect } from "react";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import UPNG from "upng-js";

const ffmpeg = createFFmpeg({ log: true });

export default function ApngConverter() {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [apngUrl, setApngUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadFFmpeg = async () => {
            if (!ffmpeg.isLoaded()) {
                await ffmpeg.load();
            }
        };
        loadFFmpeg();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploaded = e.target.files?.[0];
        if (!uploaded) return;

        setFile(uploaded);
        setPreviewUrl(URL.createObjectURL(uploaded));
        setApngUrl(null);
    };

    const handleConvert = async () => {
        if (!file || !ffmpeg.isLoaded()) return;

        setLoading(true);
        setApngUrl(null);

        const fileName = "input" + file.name.substring(file.name.lastIndexOf("."));
        ffmpeg.FS("writeFile", fileName, await fetchFile(file));

        await ffmpeg.run(
            "-i",
            fileName,
            "-vf",
            "fps=10,scale=320:-1",
            "frame_%03d.png"
        );

        const frameFiles = ffmpeg
            .FS("readdir", "/")
            .filter((f) => f.startsWith("frame_") && f.endsWith(".png"))
            .sort();

        const images: Uint8Array[] = [];
        for (const name of frameFiles) {
            const data = ffmpeg.FS("readFile", name);
            images.push(data);
        }

        const imageBuffers = images.map((i) => new Uint8Array(i));
        const imgs = imageBuffers.map((buf) => new Uint8Array(buf.buffer));

        const firstImage = new Image();
        firstImage.src = URL.createObjectURL(new Blob([imgs[0]], { type: "image/png" }));

        firstImage.onload = () => {
            const w = firstImage.width;
            const h = firstImage.height;
            const delay = 100; // ms

            const apngBuffer = UPNG.encode(imgs, w, h, 0, new Array(imgs.length).fill(delay));
            const blob = new Blob([apngBuffer], { type: "image/apng" });
            const apngUrl = URL.createObjectURL(blob);

            setApngUrl(apngUrl);
            setLoading(false);
        };
    };

    return (
        <div className="p-4 space-y-4 max-w-xl mx-auto">
            <h1 className="text-2xl font-bold">APNG Converter (Frontend Only)</h1>

            <input
                type="file"
                accept=".gif,.mp4,.webm"
                onChange={handleFileChange}
                className="block"
            />

            {previewUrl && (
                <div>
                    <h2 className="text-lg font-semibold">Preview:</h2>
                    {file?.type.startsWith("video") ? (
                        <video src={previewUrl} controls className="w-full" />
                    ) : (
                        <img src={previewUrl} alt="preview" className="w-full" />
                    )}
                </div>
            )}

            <button
                onClick={handleConvert}
                disabled={!file || loading}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
                {loading ? "Converting..." : "Convert to APNG"}
            </button>

            {apngUrl && (
                <div>
                    <h2 className="text-lg font-semibold">Result:</h2>
                    <img src={apngUrl} alt="APNG result" className="w-full" />
                    <a
                        href={apngUrl}
                        download="converted.apng"
                        className="mt-2 inline-block bg-green-600 text-white px-4 py-2 rounded"
                    >
                        Download APNG
                    </a>
                </div>
            )}
        </div>
    );
}
