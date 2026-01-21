const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Cloud Function to clean up user data upon account deletion.
 *
 * This function is triggered when a user is deleted from Firebase Authentication.
 * It performs a cascading delete to remove all associated data from Firestore,
 * ensuring compliance and data privacy.
 */
exports.cleanupUserData = functions.auth.user().onDelete(async (user) => {
  const userId = user.uid;
  functions.logger.log(`Cleaning up data for user: ${userId}`);

  // Use a batched write to perform all deletions as a single atomic operation
  const batch = db.batch();

  // 1. Delete the main user document from the 'users' collection
  const userDocRef = db.collection("users").doc(userId);
  batch.delete(userDocRef);

  // 2. Delete all trips associated with the user
  const tripsRef = db.collection("trips").where("userId", "==", userId);
  try {
    const tripsSnapshot = await tripsRef.get();
    tripsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
      functions.logger.log(`- Marked trip for deletion: ${doc.id}`);
    });
  } catch (error) {
    functions.logger.error("Error fetching trips for deletion:", error);
  }

  // 3. Delete all expenses associated with the user
  const expensesRef = db.collection("expenses").where("userId", "==", userId);
  try {
    const expensesSnapshot = await expensesRef.get();
    expensesSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
      functions.logger.log(`- Marked expense for deletion: ${doc.id}`);
    });
  } catch (error) {
    functions.logger.error("Error fetching expenses for deletion:", error);
  }
  
  // Commit the batched write to execute all deletions
  try {
    await batch.commit();
    functions.logger.log(`Successfully deleted all data for user: ${userId}`);
    return null;
  } catch (error) {
    functions.logger.error("Error committing batch delete:", error);
    return null;
  }
});
