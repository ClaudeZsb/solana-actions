import { ACTIONS_CORS_HEADERS, ActionGetRequest, ActionGetResponse, ActionPostRequest, MEMO_PROGRAM_ID, createPostResponse } from "@solana/actions"
import { ComputeBudgetInstruction, ComputeBudgetProgram, Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction, clusterApiUrl } from "@solana/web3.js";
import { DEFAULT_SOL_ADDRESS } from "./const";

export const GET = (req: Request) => {
  try {
    const requestUrl = new URL(req.url);

    const baseHref = new URL(
      `/api/actions/transfer-sol?to=${DEFAULT_SOL_ADDRESS.toBase58()}`,
      requestUrl.origin,
    ).toString();

    const payload: ActionGetResponse = {
      title: "Actions Example - Donate Native SOL",
      icon: new URL("/avatar.svg", requestUrl.origin).toString(),
      description: "Donate SOL",
      label: "Transfer", // this value will be ignored since `links.actions` exists
      links: {
        actions: [
          {
            label: "Send 1 SOL", // button text
            href: `${baseHref}&amount=${"1"}`,
          },
          {
            label: "Send 5 SOL", // button text
            href: `${baseHref}&amount=${"5"}`,
          },
          {
            label: "Send 10 SOL", // button text
            href: `${baseHref}&amount=${"10"}`,
          },
          {
            label: "Send SOL", // button text
            href: `${baseHref}&amount={amount}`, // this href will have a text input
            parameters: [
              {
                name: "amount", // parameter name in the `href` above
                label: "Enter the amount of SOL to send", // placeholder of the text input
                required: true,
              },
            ],
          },
        ],
      },
    };

    return Response.json(payload, {
      headers: ACTIONS_CORS_HEADERS,
    });
  } catch (err) {
    console.log(err);
    let message = "An unknown error occurred";
    if (typeof err == "string") message = err;
    return new Response(message, {
      status: 400,
      headers: ACTIONS_CORS_HEADERS,
    });
  }
};

export const OPTIONS = GET;

export const POST = async (req: Request) => {
  try {
    const body: ActionPostRequest = await req.json();
    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch (error) {
      return new Response("Invalid account", {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }
    const { amount, toPubkey } = validatedQueryParams(new URL(req.url));
    const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");
    // ensure the receiving account will be rent exempt
    const minimumBalance = await connection.getMinimumBalanceForRentExemption(
      0, // note: simple accounts that just store native SOL have `0` bytes of data
    );
    if (amount * LAMPORTS_PER_SOL < minimumBalance) {
      throw `account may not be rent exempt: ${toPubkey.toBase58()}`;
    }
    const transaction = new Transaction();

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: account,
        toPubkey: toPubkey,
        lamports: amount * LAMPORTS_PER_SOL,
      })
    );

    transaction.feePayer = account;

    
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const payload = await createPostResponse({
      fields: {
        transaction,
        message: `Donate ${amount} SOL to ${toPubkey.toBase58()}`,
      },
      // signers: [],
    });

    return Response.json(payload, {
      headers: ACTIONS_CORS_HEADERS,
    });
  } catch (error) {
    console.error(error);
    return Response.json("Error occured", {
      status: 400
    });
  }
}

function validatedQueryParams(requestUrl: URL) {
  let toPubkey: PublicKey = DEFAULT_SOL_ADDRESS;
  let amount: number = 1;

  try {
    if (requestUrl.searchParams.get("to")) {
      toPubkey = new PublicKey(requestUrl.searchParams.get("to")!);
    }
  } catch (err) {
    throw "Invalid input query parameter: to";
  }

  try {
    if (requestUrl.searchParams.get("amount")) {
      amount = parseFloat(requestUrl.searchParams.get("amount")!);
    }

    if (amount <= 0) throw "amount is too small";
  } catch (err) {
    throw "Invalid input query parameter: amount";
  }

  return {
    amount,
    toPubkey,
  };
}