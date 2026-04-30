package com.gptimage.playground;

import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "NativeShare")
public class NativeSharePlugin extends Plugin {
    @PluginMethod
    public void shareImage(PluginCall call) {
        String filename = call.getString("filename", "generated-image.png");
        String mimeType = call.getString("mimeType", "image/png");
        String base64Data = call.getString("base64Data");

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("Missing image data.");
            return;
        }

        try {
            byte[] imageBytes = Base64.decode(base64Data, Base64.DEFAULT);
            File shareDir = new File(getContext().getCacheDir(), "shared-images");
            if (!shareDir.exists() && !shareDir.mkdirs()) {
                call.reject("Failed to create share cache directory.");
                return;
            }

            File imageFile = new File(shareDir, filename);
            try (FileOutputStream outputStream = new FileOutputStream(imageFile)) {
                outputStream.write(imageBytes);
            }

            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                imageFile
            );

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType(mimeType);
            shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(shareIntent, "分享图片");
            getActivity().startActivity(chooser);
            call.resolve();
        } catch (Exception error) {
            call.reject("Failed to share image: " + error.getMessage(), error);
        }
    }
}
