import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase"; // تأكد من إعداد db

type UserBalanceMap = {
  [uid: string]: number;
};

 export async function getInvoicesStats() {
  const snapshot = await getDocs(collection(db, "invoices"));

  const userBalances: UserBalanceMap = {};

  snapshot.forEach((doc) => {
    const data = doc.data();
    const uid = data.uid;
    const amount = Number(data.amount);
    const isExpense = data.type === "فاتورة";

    if (!userBalances[uid]) {
      userBalances[uid] = 0;
    }

    userBalances[uid] += isExpense ? -amount : amount;
  });

  // احسب العدد والمجموع
  const usersWithPositiveBalance = Object.values(userBalances).filter(
    (balance) => balance > 0
  ).length;

  const totalBalance = Object.values(userBalances).reduce(
    (acc, curr) => acc + curr,
    0
  );

  return {
    usersWithPositiveBalance,
    totalBalance,
  };
}
