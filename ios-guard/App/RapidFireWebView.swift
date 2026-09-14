import SwiftUI
import WebKit

/// Wraps RapidFire's actual web app in a WKWebView and listens for the completion message that
/// SwipeMode.tsx posts once the whole deck is swiped (see notifyNativeDigestCompleted in
/// app/components/SwipeMode.tsx). This is the only integration point — everything else about
/// reading the news stays in the existing Next.js app, unchanged.
struct RapidFireWebView: UIViewRepresentable {
    let url: URL
    var onDigestCompleted: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onDigestCompleted: onDigestCompleted)
    }

    func makeUIView(context: Context) -> WKWebView {
        let contentController = WKUserContentController()
        contentController.add(context.coordinator, name: "rapidfireBridge")

        let config = WKWebViewConfiguration()
        config.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        let onDigestCompleted: () -> Void

        init(onDigestCompleted: @escaping () -> Void) {
            self.onDigestCompleted = onDigestCompleted
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "rapidfireBridge",
                  let body = message.body as? [String: Any],
                  body["type"] as? String == "digestCompleted"
            else { return }

            Task { @MainActor in
                onDigestCompleted()
            }
        }
    }
}
