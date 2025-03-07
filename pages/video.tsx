import {
  Box,
  Flex,
  Stack,
  Heading,
  Text,
  Container,
  Input,
  Button,
  Textarea,
  Center,
  useToast,
  Switch,
  FormControl,
  FormLabel,
  Progress,
  HStack,
} from "@chakra-ui/react";
import { useCreateAsset } from "@livepeer/react";
import { useEffect, useMemo, useState, useContext } from "react";
import { ethers } from "ethers";
import { UnlockV11, PublicLockV11 } from "@unlock-protocol/contracts";
import Navbar from "../components/Navbar";
import orbis from "./orbis";
import { useRouter } from "next/router";
import abis from "@unlock-protocol/contracts";
import create from "zustand";
import { useStore } from "../components/lockedStore";
import {
  erc20ABI,
  useAccount,
  useSendTransaction,
  useWaitForTransaction,
  useContractRead,
  usePrepareContractWrite,
} from "wagmi";
import { Filelike, Web3Storage } from "web3.storage";

import { GeneralContext } from "../context";

export default function UploadVideo() {
  const lockInterface = new ethers.utils.Interface(PublicLockV11.abi);

  const { address: creator } = useAccount();
  const [calldata, setCalldata] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(99999);
  const [supply, setSupply] = useState(99999);
  const [price, setPrice] = useState(0);
  const [currency, setCurrency] = useState("");
  const [enableDuration, setEnableDuration] = useState(false);
  const [enableSupply, setEnableSupply] = useState(false);
  const [video, setVideo] = useState<File | undefined>(undefined);
  const [thumbnail, setThumbnail] = useState<File | undefined>(undefined);
  const [thumbnailAddr, setThumbnailAddr] = useState("");

  //krebit
  const { auth, walletInformation } = useContext(GeneralContext);
  const [recipient, setRecipient] = useState<string | undefined>("");
  const [issuedCredentialId, setIssuedCredentialId] = useState("");
  const [credentials, setCredentials] = useState([]);
  useEffect(() => {
    if (!walletInformation) return;
    if (auth.status !== "resolved") return;
  }, [auth, walletInformation]);

  const getClaim = async (toAddress: string) => {
    const badgeValue = {
      entity: "blockStore",
      name: "blockStore seller",
      imageUrl:
        "https://bafkreie5zeuhbimhjfnapiqpf5n3gqx2q7b6ndfjaryupbkgcmgjaxjsua.ipfs.nftstorage.link",
      description: "Badge for seller authority",
      skills: [{ skillId: "customer", score: 100 }],
      xp: 10,
    };

    const expirationDate = new Date();
    const expiresYears = 1;
    expirationDate.setFullYear(expirationDate.getFullYear() + expiresYears);
    console.log("expirationDate: ", expirationDate);

    return {
      id: `blockStore-01`,
      ethereumAddress: toAddress,
      did: `did:pkh:eip155:1:${toAddress}`,
      type: "Badge",
      value: badgeValue,
      tags: ["Personhood", "Badge"],
      typeSchema: "krebit://schemas/badge",
      expirationDate: new Date(expirationDate).toISOString(),
    };
  };

  const issueCredential = async () => {
    const claim = await getClaim(recipient);
    const issuedCredential = await walletInformation.issuer.issue(claim);

    console.log("Issued credential:", issuedCredential);

    console.log(
      "Verifying credential:",
      await walletInformation.issuer.checkCredential(issuedCredential)
    );

    const credentialId = await walletInformation.ipassport.addIssued(
      issuedCredential
    );
    setIssuedCredentialId(credentialId);
  };

  const getIssued = async () => {
    const credentials = await walletInformation.ipassport.getIssued();
    setCredentials(credentials);
  };

  const router = useRouter();
  const {
    mutate: createAsset,
    data: assets,
    status,
    progress,
    error,
  } = useCreateAsset(
    // we use a `const` assertion here to provide better Typescript types
    // for the returned data
    video
      ? {
          sources: [{ name: video.name, file: video }] as const,
        }
      : null
  );

  const { data: decimals } = useContractRead({
    address: "0x0",
    abi: erc20ABI,
    functionName: "decimals",
    enabled: currency !== ethers.constants.AddressZero,
  });

  const toast = useToast();

  const createService = async () => {
    createAsset?.();
  };

  const { config } = usePrepareContractWrite({
    address: "lock_address",
    abi: UnlockV11.abi,
    functionName: "createUpgradeableLockAtVersion",
    args: [calldata, 11], // We currently deploy version 11
  });

  const { data: transaction, sendTransaction } = useSendTransaction(config);
  const [user, setUser] = useState();
  const {
    isLoading,
    isSuccess,
    data: receipt,
    isError,
  } = useWaitForTransaction({
    hash: transaction?.hash,
  });

  async function connect() {
    let res = await orbis.connect();

    /** Check if connection is successful or not */
    if (res.status == 200) {
      setUser(res.did);
    } else {
      console.log("Error connecting to Ceramic: ", res);
      alert("Error connecting to Ceramic.");
    }
  }

  const prepareCalldata = async (
    supply: number,
    name: string,
    price: number
  ) => {
    setCalldata(
      lockInterface.encodeFunctionData(
        "initialize(address,uint256,address,uint256,uint256,string)",
        [
          creator,
          duration * 60 * 60 * 24, // duration is in days!
          ethers.constants.AddressZero,
          ethers.utils.parseUnits(price.toString(), decimals || 18),
          supply,
          name,
        ]
      )
    );
  };

  async function getPost() {
    // console.log(res.doc);
    let { data, error } = await orbis.getPosts({ tag: "Test Tag" });
    console.log(data);
  }
  async function createPost(
    name: string,
    playbackId: string | undefined,
    description: string
  ) {
    await prepareCalldata(supply, name, price);
    sendTransaction?.();
    await connect();
    let res = await orbis.createPost({
      body: description,
      title: name,
      data: {
       
        playbackID: playbackId,
        imageUrl: thumbnailAddr,
      },
      tags: [{ slug: "videos", title: "Courses" }],
    });
    console.log("Created post:", res.doc)
    if(res.doc != null){
      router.push("/explore");
    }

    await getPost();
  }

  console.log("Assets is", assets);
  useEffect(() => {
    if (status === "success" && assets) {
      createPost(name, assets[0].playbackId!, description);
      toast({
        title:
          "Successfully created your service, please sign message to create post",
        status: "success",
        duration: 9000,
        isClosable: true,
      });
    }
    prepareCalldata(supply, name, price);
  }, [status, name, description, price, supply, duration]);

  useEffect(() => {
    if (creator == null) {
      alert("Please connect your wallet");
      router.push("/");
    }
  }, []);



  const progressFormatted = useMemo(
    () =>
      progress?.[0].phase === "failed" ? (
        "Failed to process video."
      ) : progress?.[0].phase === "waiting" ? (
        "Waiting"
      ) : progress?.[0].phase === "uploading" ? (
        <>
          <Text color="black" fontSize={"md"} textAlign="center">
            Uploading
          </Text>
          <Progress value={Math.round(progress?.[0]?.progress * 100)} />
        </>
      ) : progress?.[0].phase === "processing" ? (
        <>
          <Text color="black" fontSize={"md"} textAlign="center">
            Processing
          </Text>
          <Progress value={Math.round(progress?.[0]?.progress * 100)} />
        </>
      ) : null,
    [progress]
  );

  return (
    <Box position={"relative"}>
      <Navbar />
      <Center>
        <Container maxW={"lg"} py={[4, 8]}>
          <Stack
            bg={"gray.200"}
            rounded={"xl"}
            p={{ base: 4, sm: 6, md: 8 }}
            spacing={{ base: 8 }}
            maxW={{ lg: "lg" }}
          >
            <Stack spacing={4}>
              <Heading
                color={"gray.800"}
                lineHeight={1.1}
                fontSize={{ base: "2xl", sm: "3xl", md: "4xl" }}
              >
                Upload a video
                <Text
                  as={"span"}
                  bgGradient="linear(to-r, red.400,pink.400)"
                  bgClip="text"
                >
                  !
                </Text>
              </Heading>
              <Text color={"gray.500"} fontSize={{ base: "sm", sm: "md" }}>
                We’re looking for amazing engineers just like you! Become a part
                of our rockstar engineering team and skyrocket your career!
              </Text>
            </Stack>
            <Box as={"form"} mt={10}>
              <Stack spacing={4}>
                <Input
                  placeholder="Name"
                  bg={"gray.100"}
                  border={0}
                  color={"gray.500"}
                  _placeholder={{
                    color: "gray.500",
                  }}
                  onChange={(e) => {
                    setName(e.target.value);
                  }}
                />
                <Textarea
                  placeholder="Discription"
                  bg={"gray.100"}
                  border={0}
                  color={"gray.500"}
                  _placeholder={{
                    color: "gray.500",
                  }}
                  onChange={(e) => {
                    setDescription(e.target.value);
                  }}
                />
                <Input
                  placeholder="Price"
                  bg={"gray.100"}
                  border={0}
                  color={"gray.500"}
                  _placeholder={{
                    color: "gray.500",
                  }}
                  type="number"
                  onChange={(e) => {
                    setPrice(parseInt(e.target.value));
                  }}
                />
                <Box bg="gray.800" p={4} rounded="lg">
                  <FormControl display="flex" alignItems="center" gap={8}>
                    <HStack alignItems={"center"}>
                      <FormLabel mb={0}>Enable duration?</FormLabel>
                      <Switch
                        size={"md"}
                        colorScheme="red"
                        onChange={() => setEnableDuration(!enableDuration)}
                      />
                    </HStack>
                    <HStack alignItems={"center"}>
                      <FormLabel mb={0}>Enable supply?</FormLabel>
                      <Switch
                        size={"md"}
                        colorScheme="red"
                        onChange={() => setEnableSupply(!enableSupply)}
                      />
                    </HStack>
                  </FormControl>
                  <Flex gap={8} mt={4}>
                    {enableDuration ? (
                      <Input
                        placeholder="duration"
                        bg={"gray.100"}
                        border={0}
                        color={"gray.500"}
                        _placeholder={{
                          color: "gray.500",
                        }}
                        type="number"
                        onChange={(e) => {
                          setDuration(parseInt(e.target.value));
                        }}
                      />
                    ) : null}
                    {enableSupply ? (
                      <Input
                        placeholder="supply"
                        bg={"gray.100"}
                        border={0}
                        color={"gray.500"}
                        _placeholder={{
                          color: "gray.500",
                        }}
                        type="number"
                        onChange={(e) => {
                          setSupply(parseInt(e.target.value));
                        }}
                      />
                    ) : null}
                  </Flex>
                </Box>
                <Box p={4} rounded="lg">
                  <FormControl display="flex" alignItems="center" gap={4}>
                    <label
                      htmlFor="video"
                      style={{
                        backgroundColor: "black",
                        textAlign: "center",
                        padding: "10px",
                        fontWeight: "500",
                        borderRadius: "4px",
                        color: "white",
                        cursor: "pointer",
                        width: "100%",
                      }}
                    >
                      Select a video
                    </label>
                    <input
                      type="file"
                      id="video"
                      onChange={(e) => {
                        if (e.target.files) {
                          setVideo(e.target.files[0]);
                        }
                      }}
                      style={{ display: "none" }}
                    />
                    <Input
                      borderColor={"gray.800"}
                      _hover={{ borderColor: "blue.800", border: "2px" }}
                      p={1}
                      colorScheme="blue"
                      variant="outline"
                      w="full"
                      type="file"
                      accept="image/*"
                      name="file"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const files = (e.target as HTMLInputElement).files!;
                        const client = new Web3Storage({
                          token:
                            "web3_storage_token",
                        });
                        client.put(files).then((cid) => {
                          console.log(cid);
                          setThumbnailAddr(
                            `https://${cid}.ipfs.w3s.link/${files[0].name}`
                          );
                        });
                      }}
                    />
                  </FormControl>
                </Box>
              </Stack>
              {progressFormatted && <Text my={2}>{progressFormatted}</Text>}
              {/* Krebit */}
              {/* <div>address: {profileInformation.profile.did}</div> */}
              <div>
                <Button
                fontFamily={"heading"}
                mt={8}
                w={"full"}
                bgGradient="linear(to-r, purple.400,blue.400)"
                color={"white"}
                onClick={() => {
                  setRecipient(creator);
                  issueCredential;
                }}
                _hover={{
                  bgGradient: "linear(to-r, red.400,pink.400)",
                  boxShadow: "xl",
                }}
                disabled={isLoading}
              >
                Claim
              </Button>
              </div>
              <Button
                fontFamily={"heading"}
                mt={8}
                w={"full"}
                bgGradient="linear(to-r, red.400,pink.400)"
                color={"white"}
                onClick={() => {
                  createService();
                }}
                _hover={{
                  bgGradient: "linear(to-r, red.400,pink.400)",
                  boxShadow: "xl",
                }}
                disabled={isLoading}
              >
                Submit
              </Button>
            </Box>
            form
          </Stack>
        </Container>
      </Center>
    </Box>
  );
}
