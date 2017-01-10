/*
* Copyright (c) 2015 Razeware LLC
*/

import UIKit
import SafariServices

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    let defaults = NSUserDefaults.standardUserDefaults()
    
  func application(application: UIApplication, didFinishLaunchingWithOptions launchOptions: [NSObject: AnyObject]?) -> Bool {
    
    registerForPushNotifications(application)
    return true
  }

    func registerForPushNotifications(application: UIApplication) {
        let notificationSettings = UIUserNotificationSettings(
            forTypes: [.Badge, .Sound, .Alert], categories: nil)
        application.registerUserNotificationSettings(notificationSettings)
    } // When the app launches, you should receive a prompt that asks for permission to send you notifications:
    
    func application(application: UIApplication, didRegisterUserNotificationSettings notificationSettings: UIUserNotificationSettings) {
        if notificationSettings.types != .None {
            application.registerForRemoteNotifications()
        }
    }
    

    
    func application(application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: NSData) {
        let tokenChars = UnsafePointer<CChar>(deviceToken.bytes)
        var tokenString = ""
        
        for i in 0..<deviceToken.length {
            tokenString += String(format: "%02.2hhx", arguments: [tokenChars[i]])
        }
        
        print("Device Token:", tokenString)
        defaults.setObject(tokenString, forKey: "tokenString")

    } // when the registration is successful
    
    func application(application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: NSError) {
        print("Failed to register:", error)
    }
    
    private func extractId(fromPushNotificationUserInfo userInfo:[NSObject: AnyObject]) -> Int! {
        var message: Int?
        if let customKey = userInfo["customKey"] as? NSDictionary {
            if let first = customKey["first"] as? NSDictionary{
                if let note_id = first["note_id"] as? Int{
                    message = note_id
                    print(note_id)
                }
            }
        }
        return message
    }
    
    private func extractTitle(fromPushNotificationUserInfo userInfo:[NSObject: AnyObject]) -> Int! {
        var message: Int?
        if let aps = userInfo["aps"] as? NSDictionary {
            if let alert = aps["alert"] as? NSDictionary{
                print(alert)
                if let title = alert["title"] as? Int{
                    message = title
                    print(title)
                }
            }
        }
        return message
    }
    
    func application(application: UIApplication, didReceiveRemoteNotification userInfo: [NSObject : AnyObject], fetchCompletionHandler completionHandler: (UIBackgroundFetchResult) -> Void) {
        
        let aps = userInfo["aps"] as! [String: AnyObject]
        print(aps)
        let request_S = NSMutableURLRequest(URL: NSURL(string: "http://52.198.94.230:3000/submit_feedback")!)
        request_S.HTTPMethod = "POST"
        
        var contentAvailableKey: String?
        if let customKey = userInfo["customKey"] as? NSDictionary{
            if let contentAv = customKey["contentAv"] as? String{
                contentAvailableKey = contentAv
            }
        }
        
        if(contentAvailableKey=="1"){
            let notificationBackgroundId = extractTitle(fromPushNotificationUserInfo: userInfo)
            let postSendString = "id=\(notificationBackgroundId)&send_stat=1"
            print(postSendString)
        request_S.HTTPBody = postSendString.dataUsingEncoding(NSUTF8StringEncoding)
        let task_S = NSURLSession.sharedSession().dataTaskWithRequest(request_S) {
            data, response, error in guard error == nil && data != nil else {
                // check for fundamental networking error
                print("error=\(error)")
                return
            }
            
            if let httpStatus = response as? NSHTTPURLResponse where httpStatus.statusCode != 200 {
                // check for http errors
                print("statusCode should be 200, but is \(httpStatus.statusCode)")
                print("response = \(response)")
            }
            
            let responseString = String(data: data!, encoding: NSUTF8StringEncoding)
            print("responseString = \(responseString)")
        }
        task_S.resume()
            completionHandler(.NoData)
        }else{
            let notificationId = extractId(fromPushNotificationUserInfo: userInfo)
            let postReadString = "id=\(notificationId)&read_stat=1"
            print(postReadString)

            request_S.HTTPBody = postReadString.dataUsingEncoding(NSUTF8StringEncoding)
            let task_R = NSURLSession.sharedSession().dataTaskWithRequest(request_S) {
                data, response, error in guard error == nil && data != nil else {
                    // check for fundamental networking error
                    print("error=\(error)")
                    return
                }
            }
                task_R.resume()
            completionHandler(.NewData)

        }
        // referenced from http://stackoverflow.com/questions/26364914/http-request-in-swift-with-post-method
    }  // it wakes up the app in the background and send feedback to the server

}

